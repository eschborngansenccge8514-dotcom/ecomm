const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('No database connection string found in env.');
    process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

const DDL = `
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    user_id UUID,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_fields JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    name TEXT NOT NULL,
    account_number TEXT,
    bank_name TEXT,
    currency TEXT DEFAULT 'MYR',
    opening_balance NUMERIC(15,2) DEFAULT 0,
    current_balance NUMERIC(15,2) DEFAULT 0,
    coa_account_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference TEXT,
    debit NUMERIC(15,2) DEFAULT 0,
    credit NUMERIC(15,2) DEFAULT 0,
    amount NUMERIC(15,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    matched_journal_entry_id UUID,
    suggested_coa_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_bsl_pending ON public.bank_statement_lines(bank_account_id, status) WHERE status = 'pending';
`;

async function run() {
    try {
        console.log('Force-creating missing tables...');
        await sql.unsafe(DDL);
        console.log('✅ Tables created successfully.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Failed to create tables:', e);
        process.exit(1);
    }
}

run();
