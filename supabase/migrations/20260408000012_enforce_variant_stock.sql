-- Refactor handle_inventory_movement to validate variant requirement
CREATE OR REPLACE FUNCTION public.handle_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_track_inventory BOOLEAN;
  v_product_id UUID;
  v_has_variants BOOLEAN;
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

  -- Check if product has variants
  SELECT EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = v_product_id) INTO v_has_variants;

  -- If product has variants, movements MUST specify a variant_id
  IF v_has_variants AND NEW.variant_id IS NULL THEN
    RAISE EXCEPTION 'Product % has variants; movement must specify a variant_id.', v_product_id;
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

-- New function to prevent direct manual updates to stock_quantity on products with variants
CREATE OR REPLACE FUNCTION public.prevent_direct_stock_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if variants exist for this product
  IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = NEW.id) THEN
    -- If the change is NOT coming from a trigger (depth > 1), block manual updates.
    -- However, sync_product_stock_from_variants is also a trigger. 
    -- So we allow the update ONLY if pg_trigger_depth() > 1, 
    -- which means it's being called from another trigger (our sync trigger).
    IF NEW.stock_quantity != OLD.stock_quantity AND pg_trigger_depth() = 1 THEN
      RAISE EXCEPTION 'Cannot manually update stock_quantity for products with variants. Update the variants instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to protect products.stock_quantity
DROP TRIGGER IF EXISTS trig_prevent_direct_stock_update ON public.products;
CREATE TRIGGER trig_prevent_direct_stock_update
BEFORE UPDATE OF stock_quantity ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_stock_update();
