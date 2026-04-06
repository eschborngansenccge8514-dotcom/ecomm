-- Resend Database Webhooks Integration
-- This migration creates triggers to call Edge Functions for various events.

-- Helper function to call Edge Functions via pg_net
-- NOTE: You must provide your SERVICE_ROLE_KEY for authentication.
-- Alternatively, implement custom authentication in the Edge Functions.
CREATE OR REPLACE FUNCTION public.invoke_email_function()
RETURNS TRIGGER AS $$
DECLARE
  func_name TEXT;
  request_id BIGINT;
  payload JSONB;
  project_id TEXT := 'dgafjyrittkskxlgswvf';
  -- Ideally, fetch this from a secure vault or config table
  -- For now, we expect it to be passed or handled in the edge function (e.g. if verify_jwt is off, but that's UNSAFE)
  service_role_key TEXT := 'REPLACE_WITH_SERVICE_ROLE_KEY'; 
BEGIN
  -- Determine which function to call based on the trigger name or table
  IF TG_NAME = 'tr_order_confirmation' THEN
    func_name := 'email-order-confirmation';
    payload := jsonb_build_object('record', row_to_json(NEW));
  ELSIF TG_NAME = 'tr_order_status_update' THEN
    func_name := 'email-order-status-update';
    payload := jsonb_build_object('record', row_to_json(NEW), 'old_record', row_to_json(OLD));
  ELSIF TG_NAME = 'tr_merchant_new_order' THEN
    func_name := 'email-merchant-new-order';
    payload := jsonb_build_object('record', row_to_json(NEW));
  ELSIF TG_NAME = 'tr_low_stock_alert' THEN
    func_name := 'email-low-stock-alert';
    payload := jsonb_build_object('record', row_to_json(NEW), 'old_record', row_to_json(OLD));
  ELSIF TG_NAME = 'tr_consumer_welcome' THEN
    func_name := 'email-consumer-welcome';
    payload := jsonb_build_object('record', row_to_json(NEW));
  END IF;

  IF func_name IS NOT NULL THEN
    SELECT net.http_post(
      url => 'https://' || project_id || '.functions.supabase.co/functions/v1/' || func_name,
      headers => jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body => payload
    ) INTO request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Order Confirmation (Customer)
DROP TRIGGER IF EXISTS tr_order_confirmation ON public.orders;
CREATE TRIGGER tr_order_confirmation
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.invoke_email_function();

-- 2. Merchant New Order Alert
DROP TRIGGER IF EXISTS tr_merchant_new_order ON public.orders;
CREATE TRIGGER tr_merchant_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.invoke_email_function();

-- 3. Order Status Update (Customer)
DROP TRIGGER IF EXISTS tr_order_status_update ON public.orders;
CREATE TRIGGER tr_order_status_update
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.invoke_email_function();

-- 4. Low Stock Alert (Merchant)
DROP TRIGGER IF EXISTS tr_low_stock_alert ON public.products;
CREATE TRIGGER tr_low_stock_alert
  AFTER UPDATE OF stock_quantity ON public.products
  FOR EACH ROW
  WHEN (
    NEW.stock_quantity <= COALESCE(NEW.restock_threshold, NEW.low_stock_alert, 0) AND 
    OLD.stock_quantity > COALESCE(OLD.restock_threshold, OLD.low_stock_alert, 0)
  )
  EXECUTE FUNCTION public.invoke_email_function();

-- 5. Consumer Welcome (auth.users bridge)
-- Note: auth.users triggers require specific permissions. 
-- A common pattern is to trigger on public.profiles INSERT if created via signup.
DROP TRIGGER IF EXISTS tr_consumer_welcome ON public.profiles;
CREATE TRIGGER tr_consumer_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.invoke_email_function();
