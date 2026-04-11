-- Trigger to create agent approvals when stock is low
CREATE OR REPLACE FUNCTION public.handle_low_stock_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_preferred_supplier_id UUID;
    v_suggested_qty NUMERIC;
BEGIN
    -- Only trigger if stock is now below or equal to alert level AND was previously above it (to avoid spam)
    IF NEW.stock_quantity <= NEW.low_stock_alert AND (OLD.stock_quantity > NEW.low_stock_alert OR OLD.stock_quantity IS NULL) AND NEW.status = 'active' THEN
        
        -- Try to find preferred supplier and intelligent suggestion
        SELECT preferred_supplier_id, suggested_qty INTO v_preferred_supplier_id, v_suggested_qty
        FROM get_reorder_suggestions(NEW.merchant_id)
        WHERE product_id = NEW.id
        LIMIT 1;

        -- Create an approval request for the agent
        INSERT INTO public.agent_approvals (
            merchant_id,
            type,
            status,
            priority,
            title,
            description,
            metadata
        ) VALUES (
            NEW.merchant_id,
            'inventory_reorder',
            'pending',
            'high',
            'Low Stock Alert: ' || NEW.name,
            'Item stock is at ' || NEW.stock_quantity || '. Suggested reorder: ' || COALESCE(v_suggested_qty, 10)::TEXT || ' units.',
            jsonb_build_object(
                'product_id', NEW.id,
                'current_stock', NEW.stock_quantity,
                'suggested_qty', COALESCE(v_suggested_qty, 10),
                'supplier_id', v_preferred_supplier_id
            )
        )
        ON CONFLICT (merchant_id, type, title) WHERE status = 'pending' DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unique constraint to prevent duplicate pending approvals for the same product alert
-- First ensure agent_approvals has a unique field or logic
ALTER TABLE public.agent_approvals ADD CONSTRAINT unique_pending_reorder UNIQUE (merchant_id, type, title);

-- Trigger for products
DROP TRIGGER IF EXISTS trig_low_stock_alert ON public.products;
CREATE TRIGGER trig_low_stock_alert
AFTER UPDATE OF stock_quantity ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.handle_low_stock_alert();
