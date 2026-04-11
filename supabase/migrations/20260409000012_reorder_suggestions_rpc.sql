-- RPC to get intelligent reorder suggestions based on sales velocity
CREATE OR REPLACE FUNCTION get_reorder_suggestions(
    p_merchant_id UUID,
    p_threshold_days INTEGER DEFAULT 14
)
RETURNS TABLE (
    product_id UUID,
    variant_id UUID,
    name TEXT,
    current_stock NUMERIC,
    avg_daily_sales NUMERIC,
    days_remaining NUMERIC,
    suggested_qty NUMERIC,
    preferred_supplier_id UUID,
    preferred_supplier_name TEXT,
    unit_cost NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH daily_sales AS (
        -- Calculate average sales over the last 30 days
        SELECT 
            oi.product_id,
            oi.variant_id,
            SUM(oi.quantity)::NUMERIC / 30.0 as avg_velocity
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.merchant_id = p_merchant_id
          AND o.created_at >= NOW() - INTERVAL '30 days'
          AND o.status IN ('paid', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered')
        GROUP BY oi.product_id, oi.variant_id
    ),
    product_details AS (
        SELECT 
            p.id as pid,
            v.id as vid,
            COALESCE(p.name || (CASE WHEN v.name IS NOT NULL THEN ' — ' || v.name ELSE '' END), p.name) as full_name,
            COALESCE(v.stock_quantity, p.stock_quantity)::NUMERIC as stock,
            p.low_stock_alert
        FROM products p
        LEFT JOIN product_variants v ON v.product_id = p.id
        WHERE p.merchant_id = p_merchant_id
          AND p.status = 'active'
          AND p.track_inventory = true
    ),
    suppliers AS (
        -- Get preferred supplier and cost
        SELECT DISTINCT ON (ps.product_id, COALESCE(ps.variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
            ps.product_id,
            ps.variant_id,
            ps.supplier_id,
            s.name as supplier_name,
            ps.unit_cost
        FROM product_suppliers ps
        JOIN suppliers s ON ps.supplier_id = s.id
        WHERE ps.merchant_id = p_merchant_id
        ORDER BY ps.product_id, COALESCE(ps.variant_id, '00000000-0000-0000-0000-000000000000'::uuid), ps.is_preferred DESC, ps.created_at DESC
    )
    SELECT 
        pd.pid,
        pd.vid,
        pd.full_name,
        pd.stock,
        COALESCE(ds.avg_velocity, 0) as velocity,
        CASE 
            WHEN COALESCE(ds.avg_velocity, 0) = 0 THEN 9999 
            ELSE pd.stock / ds.avg_velocity 
        END as remaining,
        -- Suggested Qty: Enough for 30 days of sales, minimum of 10
        GREATEST(CEIL(COALESCE(ds.avg_velocity, 0) * 30), 10)::NUMERIC as suggest,
        sup.supplier_id,
        sup.supplier_name,
        COALESCE(sup.unit_cost, 0)
    FROM product_details pd
    LEFT JOIN daily_sales ds ON ds.product_id = pd.pid AND (ds.variant_id IS NOT NULL AND ds.variant_id = pd.vid OR ds.variant_id IS NULL AND pd.vid IS NULL)
    LEFT JOIN suppliers sup ON sup.product_id = pd.pid AND (sup.variant_id IS NOT NULL AND sup.variant_id = pd.vid OR sup.variant_id IS NULL AND pd.vid IS NULL)
    WHERE 
        -- Filter: Stock is below alert level OR we will run out within the threshold days
        pd.stock <= pd.low_stock_alert 
        OR (COALESCE(ds.avg_velocity, 0) > 0 AND (pd.stock / ds.avg_velocity) <= p_threshold_days)
    ORDER BY remaining ASC;
END;
$$;
