require('dotenv').config();
const { pool } = require('./pool');

const migrations = [

  // ─── Phase 1 ─────────────────────────────────────────────────────────

  `CREATE TABLE IF NOT EXISTS einvoices (
    id              SERIAL PRIMARY KEY,
    merchant_id     INT,
    order_number    VARCHAR(100) UNIQUE NOT NULL,
    invoice_type    VARCHAR(30) NOT NULL,
    submission_uid  VARCHAR(200),
    lhdn_uuid       VARCHAR(200),
    lhdn_long_id    VARCHAR(500),
    qr_code_url     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    submitted_at    TIMESTAMP WITH TIME ZONE,
    validated_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS consolidated_staging (
    id                       SERIAL PRIMARY KEY,
    merchant_id              INT,
    order_number             VARCHAR(100) UNIQUE NOT NULL,
    subtotal                 DECIMAL(12,2) NOT NULL,
    tax                      DECIMAL(12,2) NOT NULL DEFAULT 0,
    year                     INT NOT NULL,
    month                    INT NOT NULL,
    consolidated_einvoice_id INT REFERENCES einvoices(id),
    consolidated_at          TIMESTAMP WITH TIME ZONE,
    staged_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS einvoice_audit_log (
    id            SERIAL PRIMARY KEY,
    merchant_id   INT,
    order_number  VARCHAR(100),
    action        VARCHAR(50),
    endpoint      TEXT,
    request_body  JSONB DEFAULT '{}',
    response_body JSONB DEFAULT '{}',
    status_code   INT,
    duration_ms   INT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS failed_invoice_jobs (
    id           SERIAL PRIMARY KEY,
    merchant_id  INT,
    job_id       VARCHAR(200),
    job_type     VARCHAR(50),
    order_number VARCHAR(100),
    error        TEXT,
    attempts     INT DEFAULT 0,
    payload      JSONB DEFAULT '{}',
    failed_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved     BOOLEAN DEFAULT FALSE,
    resolved_at  TIMESTAMP WITH TIME ZONE,
    resolved_by  VARCHAR(200)
  )`,

  // Shared updated_at trigger function
  `CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = NOW();
     RETURN NEW;
   END;
   $$ language 'plpgsql'`,

  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgname = 'set_einvoices_updated_at'
     ) THEN
       CREATE TRIGGER set_einvoices_updated_at
         BEFORE UPDATE ON einvoices
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
     END IF;
   END $$`,

  // ─── Phase 2 — Multi-tenant ───────────────────────────────────────────

  `CREATE TABLE IF NOT EXISTS merchants (
    id                  SERIAL PRIMARY KEY,
    merchant_uid        VARCHAR(100) UNIQUE NOT NULL,
    name                VARCHAR(200) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','suspended','inactive')),
    env                 VARCHAR(20) NOT NULL DEFAULT 'sandbox'
                          CHECK (env IN ('sandbox','production')),

    -- LHDN supplier info
    tin                 VARCHAR(50),
    brn                 VARCHAR(50),
    msic                VARCHAR(20) DEFAULT '47910',
    phone               VARCHAR(50),
    email               VARCHAR(200),
    address             VARCHAR(500),
    postcode            VARCHAR(20),
    city                VARCHAR(100),
    state               VARCHAR(10),
    country             VARCHAR(10) DEFAULT 'MYS',

    -- LHDN API credentials
    lhdn_client_id      VARCHAR(300),
    lhdn_client_secret  VARCHAR(300),

    -- Digital certificate
    cert_p12_base64     TEXT,
    cert_passphrase     VARCHAR(500),
    cert_issuer_name    VARCHAR(500),
    cert_serial_number  VARCHAR(200),

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgname = 'set_merchants_updated_at'
     ) THEN
       CREATE TRIGGER set_merchants_updated_at
         BEFORE UPDATE ON merchants
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
     END IF;
   END $$`,

  // Add merchant_id FK to all tables
  `ALTER TABLE einvoices
     ADD COLUMN IF NOT EXISTS merchant_id INT REFERENCES merchants(id)`,

  `ALTER TABLE consolidated_staging
     ADD COLUMN IF NOT EXISTS merchant_id INT REFERENCES merchants(id)`,

  `ALTER TABLE einvoice_audit_log
     ADD COLUMN IF NOT EXISTS merchant_id INT REFERENCES merchants(id)`,

  `ALTER TABLE failed_invoice_jobs
     ADD COLUMN IF NOT EXISTS merchant_id INT REFERENCES merchants(id)`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_merchants_uid
     ON merchants(merchant_uid)`,

  `CREATE INDEX IF NOT EXISTS idx_merchants_status_env
     ON merchants(status, env)`,

  `CREATE INDEX IF NOT EXISTS idx_einvoices_merchant_status
     ON einvoices(merchant_id, status)`,

  `CREATE INDEX IF NOT EXISTS idx_einvoices_order
     ON einvoices(order_number)`,

  `CREATE INDEX IF NOT EXISTS idx_consolidated_merchant_period
     ON consolidated_staging(merchant_id, year, month)`,

  `CREATE INDEX IF NOT EXISTS idx_audit_merchant_created
     ON einvoice_audit_log(merchant_id, created_at DESC)`,

  `CREATE INDEX IF NOT EXISTS idx_failed_jobs_merchant_resolved
     ON failed_invoice_jobs(merchant_id, resolved)`,

  // ─── Phase 4 — Production audit log ──────────────────────────────────

  `CREATE TABLE IF NOT EXISTS einvoice_production_log (
    id               SERIAL PRIMARY KEY,
    merchant_id      INT NOT NULL REFERENCES merchants(id),
    order_number     VARCHAR(100) NOT NULL,
    lhdn_uuid        VARCHAR(200) NOT NULL,
    lhdn_long_id     VARCHAR(500),
    invoice_type     VARCHAR(30),
    amount           DECIMAL(12,2),
    issued_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tax_period_year  INT,
    tax_period_month INT
  )`,

  `CREATE INDEX IF NOT EXISTS idx_prod_log_merchant_period
     ON einvoice_production_log(merchant_id, tax_period_year, tax_period_month)`,

];

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const schema = process.env.DB_SCHEMA || 'einvoicing';

    // 1. Ensure schema exists
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

    // 2. Set search path for this session
    await client.query(`SET search_path TO ${schema}, public`);

    // Migration tracker table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id          SERIAL PRIMARY KEY,
        checksum    VARCHAR(64) UNIQUE NOT NULL,
        applied_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query(
      `SELECT checksum FROM schema_migrations`
    );
    const appliedSet = new Set(applied.map(r => r.checksum));

    const crypto = require('crypto');
    let ran = 0;

    for (const sql of migrations) {
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      if (appliedSet.has(checksum)) continue;

      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (checksum) VALUES ($1)`,
        [checksum]
      );
      ran++;
    }

    await client.query('COMMIT');

    if (ran > 0) {
      console.log(`[Migrate] ✅ Applied ${ran} migration(s)`);
    } else {
      console.log('[Migrate] ✅ Schema is up to date');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migrate] ❌ Failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Run directly: node db/migrate.js
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigrations };
