-- Accounting Engine Phase 3: Automated COA Seeding

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trg_seed_coa ON merchants;

-- Create a function that calls seed_merchant_coa
CREATE OR REPLACE FUNCTION trigger_seed_coa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the existing seed_merchant_coa function
  PERFORM seed_merchant_coa(NEW.id);
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_seed_coa
  AFTER INSERT ON merchants
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_coa();
