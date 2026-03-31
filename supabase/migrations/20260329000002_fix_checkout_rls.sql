-- 1. Update create_order_v2 to SECURITY DEFINER and add auth check
CREATE OR REPLACE FUNCTION public.create_order_v2(
  p_order_number text, 
  p_merchant_id uuid, 
  p_customer_id uuid, 
  p_subtotal numeric, 
  p_delivery_fee numeric, 
  p_discount_amount numeric, 
  p_total_amount numeric, 
  p_payment_method text, 
  p_delivery_type text, 
  p_delivery_provider text, 
  p_delivery_address jsonb, 
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with creator's permissions (bypassing RLS)
SET search_path = public -- Secure search path
AS $$
DECLARE
  v_order_id UUID;
  v_item RECORD;
  v_stock INTEGER;
BEGIN
  -- Security check: Ensure the caller is the customer they claim to be
  -- Note: We allow service role or superuser to skip this check
  IF p_customer_id != auth.uid() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Customer ID mismatch';
  END IF;

  -- 1. Check stock for all items first
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER)
  LOOP
    SELECT stock_quantity INTO v_stock 
    FROM public.products 
    WHERE id = v_item.product_id 
    FOR UPDATE;

    IF v_stock < v_item.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: %', v_item.product_id;
    END IF;
  END LOOP;

  -- 2. Create the order
  INSERT INTO public.orders (
    order_number, merchant_id, customer_id, status, subtotal, 
    delivery_fee, discount_amount, total_amount, payment_method, 
    payment_status, delivery_type, delivery_provider, delivery_address
  ) VALUES (
    p_order_number, p_merchant_id, p_customer_id, 'pending', p_subtotal, 
    p_delivery_fee, p_discount_amount, p_total_amount, p_payment_method::payment_method, 
    'unpaid', p_delivery_type, p_delivery_provider::delivery_provider, p_delivery_address
  ) RETURNING id INTO v_order_id;

  -- 3. Insert items and create reservations
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID, quantity INTEGER, unit_price NUMERIC, 
    product_name TEXT, variant_id UUID, variant_name TEXT
  )
  LOOP
    -- Insert order item
    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, 
      variant_name, unit_price, quantity, line_total
    ) VALUES (
      v_order_id, v_item.product_id, v_item.variant_id, v_item.product_name, 
      v_item.variant_name, v_item.unit_price, v_item.quantity, v_item.unit_price * v_item.quantity
    );

    -- Create reservation
    INSERT INTO public.cart_reservations (
      product_id, variant_id, quantity, user_id, expires_at, status
    ) VALUES (
      v_item.product_id, v_item.variant_id, v_item.quantity, p_customer_id, 
      NOW() + INTERVAL '15 minutes', 'reserved'
    );

    -- Decrement stock
    UPDATE public.products 
    SET stock_quantity = stock_quantity - v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;

  -- 4. Lock the cart
  UPDATE public.carts 
  SET locked_at = NOW(), locked_by = p_order_number
  WHERE user_id = p_customer_id AND merchant_id = p_merchant_id;

  RETURN v_order_id;
END;
$$;

-- 2. Add missing RLS policies for cart_reservations
ALTER TABLE public.cart_reservations ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own reservations
DROP POLICY IF EXISTS "Users can view their own reservations" ON public.cart_reservations;
CREATE POLICY "Users can view their own reservations"
ON public.cart_reservations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to insert their own reservations (for direct API access, though the RPC handles it now)
DROP POLICY IF EXISTS "Users can insert their own reservations" ON public.cart_reservations;
CREATE POLICY "Users can insert their own reservations"
ON public.cart_reservations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own reservations
DROP POLICY IF EXISTS "Users can update their own reservations" ON public.cart_reservations;
CREATE POLICY "Users can update their own reservations"
ON public.cart_reservations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own reservations
DROP POLICY IF EXISTS "Users can delete their own reservations" ON public.cart_reservations;
CREATE POLICY "Users can delete their own reservations"
ON public.cart_reservations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
