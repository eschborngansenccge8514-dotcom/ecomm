-- Fix get_dashboard_overview RPC to use correct column names for expenses
CREATE OR REPLACE FUNCTION get_dashboard_overview(
    p_merchant_id UUID,
    p_start DATE,
    p_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_revenue NUMERIC;
    v_total_cogs NUMERIC;
    v_total_expenses NUMERIC;
    v_net_pnl NUMERIC;
    v_daily_stats JSONB;
    v_top_products JSONB;
    v_recent_orders JSONB;
    v_alerts JSONB;
BEGIN
    -- 1. Calculate total revenue from paid orders
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_revenue
    FROM orders
    WHERE merchant_id = p_merchant_id
      AND status IN ('paid', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered')
      AND created_at::date BETWEEN p_start AND p_end;

    -- 2. Calculate COGS from order items (unit_price * cost_price fallback)
    SELECT COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, 0)), 0)
    INTO v_total_cogs
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.merchant_id = p_merchant_id
      AND o.status IN ('paid', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered')
      AND o.created_at::date BETWEEN p_start AND p_end;

    -- 3. Calculate total expenses (from direct expenses table)
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_expenses
    FROM expenses
    WHERE merchant_id = p_merchant_id
      AND (receipt_date::date BETWEEN p_start AND p_end OR (receipt_date IS NULL AND created_at::date BETWEEN p_start AND p_end));

    -- 4. Calculate Net P&L
    v_net_pnl := v_total_revenue - v_total_cogs - v_total_expenses;

    -- 5. Get Daily Trends (Revenue and Profit)
    WITH daily_series AS (
        SELECT generate_series(p_start::timestamp, p_end::timestamp, '1 day'::interval)::date as day
    ),
    daily_revenue AS (
        SELECT 
            created_at::date as day,
            SUM(total_amount) as revenue
        FROM orders
        WHERE merchant_id = p_merchant_id
          AND status IN ('paid', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered')
          AND created_at::date BETWEEN p_start AND p_end
        GROUP BY 1
    ),
    daily_cogs AS (
        SELECT 
            o.created_at::date as day,
            SUM(oi.quantity * COALESCE(p.cost_price, 0)) as cogs
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.merchant_id = p_merchant_id
          AND o.status IN ('paid', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered')
          AND o.created_at::date BETWEEN p_start AND p_end
        GROUP BY 1
    )
    SELECT json_agg(json_build_object(
        'date', ds.day,
        'revenue', COALESCE(r.revenue, 0),
        'profit', COALESCE(r.revenue, 0) - COALESCE(c.cogs, 0)
    ) ORDER BY ds.day)
    INTO v_daily_stats
    FROM daily_series ds
    LEFT JOIN daily_revenue r ON ds.day = r.day
    LEFT JOIN daily_cogs c ON ds.day = c.day;

    -- 6. Get Top 5 Products by Revenue
    SELECT COALESCE(json_agg(t), '[]'::json)
    INTO v_top_products
    FROM (
        SELECT 
            p.name,
            SUM(oi.quantity) as quantity,
            SUM(oi.line_total) as revenue,
            SUM(oi.line_total - (oi.quantity * COALESCE(p.cost_price, 0))) as profit
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.merchant_id = p_merchant_id
          AND o.status IN ('paid', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered')
          AND o.created_at::date BETWEEN p_start AND p_end
        GROUP BY p.name
        ORDER BY revenue DESC
        LIMIT 5
    ) t;

    -- 7. Get Recent Orders (last 5)
    SELECT COALESCE(json_agg(t), '[]'::json)
    INTO v_recent_orders
    FROM (
        SELECT 
            o.id,
            o.order_number,
            o.total_amount,
            o.status,
            o.created_at,
            pr.full_name as customer_name
        FROM orders o
        LEFT JOIN profiles pr ON o.customer_id = pr.id
        WHERE o.merchant_id = p_merchant_id
        ORDER BY o.created_at DESC
        LIMIT 5
    ) t;

    -- 8. System Alerts / Pulse Check
    SELECT json_build_object(
        'low_stock_count', (SELECT COUNT(*) FROM products WHERE merchant_id = p_merchant_id AND stock_quantity <= low_stock_alert AND status = 'active'),
        'pending_orders_count', (SELECT COUNT(*) FROM orders WHERE merchant_id = p_merchant_id AND status = 'pending'),
        'pending_approvals_count', (SELECT COUNT(*) FROM agent_approvals WHERE merchant_id = p_merchant_id AND status = 'pending')
    ) INTO v_alerts;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'revenue', v_total_revenue,
            'cogs', v_total_cogs,
            'expenses', v_total_expenses,
            'net_pnl', v_net_pnl,
            'gross_margin', CASE WHEN v_total_revenue > 0 THEN (v_total_revenue - v_total_cogs) / v_total_revenue ELSE 0 END
        ),
        'trends', COALESCE(v_daily_stats, '[]'::jsonb),
        'top_products', COALESCE(v_top_products, '[]'::jsonb),
        'recent_orders', v_recent_orders,
        'alerts', v_alerts
    );
END;
$$;
