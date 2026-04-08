-- Handle stock changes from inventory movements
CREATE OR REPLACE FUNCTION public.handle_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_track_inventory BOOLEAN;
  v_product_id UUID;
BEGIN
  v_product_id := NEW.product_id;
  
  -- Get tracking status of the parent product
  SELECT track_inventory INTO v_track_inventory 
  FROM public.products 
  WHERE id = v_product_id;

  -- If not tracking, we still record the movement but don't update stock counts
  IF v_track_inventory IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Update variant stock if variant_id is specified
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
    SET stock_quantity = stock_quantity + NEW.quantity_delta
    WHERE id = NEW.variant_id;
  ELSE
    -- Otherwise update the product stock directly (only for products without variants)
    UPDATE public.products
    SET stock_quantity = stock_quantity + NEW.quantity_delta
    WHERE id = v_product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update stock whenever a movement is recorded
DROP TRIGGER IF EXISTS trig_update_stock_on_movement ON public.inventory_movements;
CREATE TRIGGER trig_update_stock_on_movement
AFTER INSERT ON public.inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_movement();

-- Sync parent product stock whenever a variant's stock is updated
CREATE OR REPLACE FUNCTION public.sync_product_stock_from_variants()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_total_stock INTEGER;
BEGIN
  -- Determine product_id from OLD or NEW
  IF (TG_OP = 'DELETE') THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;

  -- Calculate total stock across all variants
  SELECT COALESCE(SUM(stock_quantity), 0) INTO v_total_stock
  FROM public.product_variants
  WHERE product_id = v_product_id;

  -- Update parent product stock_quantity
  UPDATE public.products
  SET stock_quantity = v_total_stock,
      updated_at = NOW()
  WHERE id = v_product_id;

  RETURN NULL; -- result is ignored for AFTER triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to keep products table in sync with variants
DROP TRIGGER IF EXISTS trig_sync_product_stock ON public.product_variants;
CREATE TRIGGER trig_sync_product_stock
AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_stock_from_variants();
