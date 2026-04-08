-- The receive_goods RPC is no longer used.
-- All goods receiving logic is now handled in the server action (purchase-order-actions.ts).
-- Replace the RPC with a no-op to prevent any accidental double-stock updates.

CREATE OR REPLACE FUNCTION public.receive_goods(p_receipt_id uuid, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
BEGIN
  -- No-op: stock updates are handled by the application layer.
  -- See receiveGoods() in purchase-order-actions.ts.
END;
$$;
