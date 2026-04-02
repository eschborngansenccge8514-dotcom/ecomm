const { Pool } = require('pg');

// Use DATABASE_URL if provided, otherwise fall back to individual env vars
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'einvoice',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    };

const pool = new Pool({
  ...poolConfig,
  // Connection pool settings
  max:                    20,
  idleTimeoutMillis:      30000,
  connectionTimeoutMillis: 5000,
});

// Set search_path to einvoicing schema so unqualified table names resolve there
pool.on('connect', (client) => {
  const schema = process.env.DB_SCHEMA || 'einvoicing';
  client.query(`SET search_path TO ${schema}, public`);
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

async function ping() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

module.exports = { pool, ping };

