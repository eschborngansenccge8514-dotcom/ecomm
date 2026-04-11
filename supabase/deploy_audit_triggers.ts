import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), 'apps/dashboard/.env') });

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('❌ Error: No DATABASE_URL found.');
    process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

const AUDIT_DDL = `
-- 1. Create the Audit Logging Function
CREATE OR REPLACE FUNCTION public.proc_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_merchant_id UUID;
    v_changed_fields JSONB := '[]'::jsonb;
BEGIN
    -- Identify merchant_id (tables being audited must have a merchant_id column)
    IF (TG_OP = 'DELETE') THEN
        v_merchant_id := OLD.merchant_id;
    ELSE
        v_merchant_id := NEW.merchant_id;
    END IF;

    -- Compute changed fields for UPDATES
    IF (TG_OP = 'UPDATE') THEN
        SELECT jsonb_agg(key) INTO v_changed_fields
        FROM (
            SELECT key FROM jsonb_each(to_jsonb(OLD))
            INTERSECT
            SELECT key FROM jsonb_each(to_jsonb(NEW))
            WHERE to_jsonb(OLD)->key IS DISTINCT FROM to_jsonb(NEW)->key
        ) s;
    END IF;

    INSERT INTO public.audit_logs (
        merchant_id,
        user_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_fields
    ) VALUES (
        v_merchant_id,
        auth.uid(),
        TG_TABLE_NAME,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        v_changed_fields
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach Triggers (Drop if exists to avoid duplication)
DROP TRIGGER IF EXISTS trig_audit_products ON public.products;
CREATE TRIGGER trig_audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

DROP TRIGGER IF EXISTS trig_audit_journal_entries ON public.journal_entries;
CREATE TRIGGER trig_audit_journal_entries AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

DROP TRIGGER IF EXISTS trig_audit_bank_accounts ON public.bank_accounts;
CREATE TRIGGER trig_audit_bank_accounts AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

DROP TRIGGER IF EXISTS trig_audit_bank_lines ON public.bank_statement_lines;
CREATE TRIGGER trig_audit_bank_lines AFTER INSERT OR UPDATE OR DELETE ON public.bank_statement_lines FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();
`;

async function deploy() {
    try {
        console.log('🚀 Deploying Audit Triggers...');
        await sql.unsafe(AUDIT_DDL);
        console.log('✅ Audit Trail is now ACTIVE on products, journal entries, and bank accounts.');
        process.exit(0);
    } catch (e: any) {
        console.error('❌ Deployment failed:', e.message);
        process.exit(1);
    }
}

deploy();
