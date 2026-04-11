import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from both root and dashboard apps, prioritize .env.local
const findEnv = () => {
    const rootEnvLocal = path.join(process.cwd(), '.env.local');
    const rootEnv = path.join(process.cwd(), '.env');
    const dashEnvLocal = path.join(process.cwd(), 'apps/dashboard/.env.local');
    const dashEnv = path.join(process.cwd(), 'apps/dashboard/.env');
    
    // Also check parent dir if we are inside 'supabase/'
    const upRootEnvLocal = path.join(process.cwd(), '..', '.env.local');
    const upDashEnvLocal = path.join(process.cwd(), '..', 'apps/dashboard/.env.local');

    [rootEnvLocal, rootEnv, dashEnvLocal, dashEnv, upRootEnvLocal, upDashEnvLocal].forEach(p => {
        dotenv.config({ path: p });
    });
};

findEnv();

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('❌ Error: No DATABASE_URL found in .env files (checked .env, .env.local in root and apps/dashboard).');
    process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

const DDL = `
-- 1. Universal Audit Log
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

-- 2. Bank Accounts
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

-- 3. Bank Statement Lines
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference TEXT,
    debit NUMERIC(15,2) DEFAULT 0,
    credit NUMERIC(15,2) DEFAULT 0,
    amount NUMERIC(15,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'ignored', 'manual')),
    matched_journal_entry_id UUID,
    suggested_coa_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_bsl_pending ON public.bank_statement_lines(bank_account_id, status) WHERE status = 'pending';
`;

async function repair() {
    try {
        console.log('🚀 Starting Phase 07 Schema Repair...');
        await sql.unsafe(DDL);
        console.log('✅ Tables created/verified successfully!');
        process.exit(0);
    } catch (e: any) {
        console.error('❌ Repair failed:', e.message);
        process.exit(1);
    }
}

repair();
