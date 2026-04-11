-- Update get_dashboard_overview to include POS transactions and revenue breakdown
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
    v_web_revenue NUMERIC;
    v_pos_revenue NUMERIC;
    v_total_revenue NUMERIC;
    v_web_cogs NUMERIC;
    v_pos_cogs NUMERIC;
    v_total_cogs NUMERIC;
    v_total_expenses NUMERIC;
    v_net_pnl NUMERIC;
    v_daily_stats JSONB;
    v_top_products JSONB;
    v_recent_orders JSONB;
    v_alerts JSONB;
    v_purchase_summary JSONB;
    v_recent_purchases JSONB;
    
    -- Previous Period
    v_prev_start DATE;
    v_prev_end DATE;
    v_prev_web_revenue NUMERIC;
    v_prev_pos_revenue NUMERIC;
    v_prev_total_revenue NUMERIC;
    v_prev_total_cogs NUMERIC;
    v_prev_total_expenses NUMERIC;
BEGIN
    -- Calculate previous period for growth comparison
    v_prev_end := p_start - INTERVAL '1 day';
    v_prev_start := v_prev_end - (p_end - p_start);

    -- 1. Current Period Web Revenue
    SELECT COALESCE(SUM(total_amount), 0) INTO v_web_revenue
    FROM orders
    WHERE merchant_id = p_merchant_id AND status NOT IN ('pending', 'cancelled')
      AND created_at::date BETWEEN p_start AND p_end;

    -- 2. Current Period POS Revenue
    SELECT COALESCE(SUM(total_rm), 0) INTO v_pos_revenue
    FROM pos_transactions
    WHERE merchant_id = p_merchant_id
      AND created_at::date BETWEEN p_start AND p_end;

    v_total_revenue := v_web_revenue + v_pos_revenue;

    -- 3. Previous Period Revenue (for comparison)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_prev_web_revenue
    FROM orders
    WHERE merchant_id = p_merchant_id AND status NOT IN ('pending', 'cancelled')
      AND created_at::date BETWEEN v_prev_start AND v_prev_end;

    SELECT COALESCE(SUM(total_rm), 0) INTO v_prev_pos_revenue
    FROM pos_transactions
    WHERE merchant_id = p_merchant_id
      AND created_at::date BETWEEN v_prev_start AND v_prev_end;

    v_prev_total_revenue := v_prev_web_revenue + v_prev_pos_revenue;

    -- 4. Calculate COGS (Unified)
    SELECT COALESCE(SUM(cogs), 0) INTO v_total_cogs
    FROM (
        SELECT oi.quantity * COALESCE(p.cost_price, 0) as cogs
        FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id
        WHERE o.merchant_id = p_merchant_id AND o.status NOT IN ('pending', 'cancelled')
          AND o.created_at::date BETWEEN p_start AND p_end
        UNION ALL
        SELECT pti.qty * COALESCE(p.cost_price, 0) as cogs
        FROM pos_transaction_items pti JOIN pos_transactions pt ON pti.transaction_id = pt.id JOIN products p ON pti.product_id = p.id
        WHERE pt.merchant_id = p_merchant_id AND pt.created_at::date BETWEEN p_start AND p_end
    ) t;

    -- Prev COGS
    SELECT COALESCE(SUM(cogs), 0) INTO v_prev_total_cogs
    FROM (
        SELECT oi.quantity * COALESCE(p.cost_price, 0) as cogs
        FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id
        WHERE o.merchant_id = p_merchant_id AND o.status NOT IN ('pending', 'cancelled')
          AND o.created_at::date BETWEEN v_prev_start AND v_prev_end
        UNION ALL
        SELECT pti.qty * COALESCE(p.cost_price, 0) as cogs
        FROM pos_transaction_items pti JOIN pos_transactions pt ON pti.transaction_id = pt.id JOIN products p ON pti.product_id = p.id
        WHERE pt.merchant_id = p_merchant_id AND pt.created_at::date BETWEEN v_prev_start AND v_prev_end
    ) t;

    -- 5. Calculate Expenses
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_expenses
    FROM expenses
    WHERE merchant_id = p_merchant_id
      AND (receipt_date::date BETWEEN p_start AND p_end OR (receipt_date IS NULL AND created_at::date BETWEEN p_start AND p_end));

    SELECT COALESCE(SUM(total_amount), 0) INTO v_prev_total_expenses
    FROM expenses
    WHERE merchant_id = p_merchant_id
      AND (receipt_date::date BETWEEN v_prev_start AND v_prev_end OR (receipt_date IS NULL AND created_at::date BETWEEN v_prev_start AND v_prev_end));

    -- 6. Net P&L
    v_net_pnl := v_total_revenue - v_total_cogs - v_total_expenses;

    -- 7. Daily Trends (Combined)
    WITH daily_series AS (
        SELECT generate_series(p_start::timestamp, p_end::timestamp, '1 day'::interval)::date as day
    ),
    web_daily AS (
        SELECT created_at::date as day, SUM(total_amount) as revenue
        FROM orders
        WHERE merchant_id = p_merchant_id AND status NOT IN ('pending', 'cancelled')
          AND created_at::date BETWEEN p_start AND p_end GROUP BY 1
    ),
    pos_daily AS (
        SELECT created_at::date as day, SUM(total_rm) as revenue
        FROM pos_transactions
        WHERE merchant_id = p_merchant_id AND created_at::date BETWEEN p_start AND p_end GROUP BY 1
    ),
    combined_revenue AS (
        SELECT day, SUM(revenue) as revenue FROM (SELECT day, revenue FROM web_daily UNION ALL SELECT day, revenue FROM pos_daily) t GROUP BY 1
    ),
    web_cogs_daily AS (
        SELECT o.created_at::date as day, SUM(oi.quantity * COALESCE(p.cost_price, 0)) as cogs
        FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id
        WHERE o.merchant_id = p_merchant_id AND o.status NOT IN ('pending', 'cancelled')
          AND o.created_at::date BETWEEN p_start AND p_end GROUP BY 1
    ),
    pos_cogs_daily AS (
        SELECT pt.created_at::date as day, SUM(pti.qty * COALESCE(p.cost_price, 0)) as cogs
        FROM pos_transaction_items pti JOIN pos_transactions pt ON pti.transaction_id = pt.id JOIN products p ON pti.product_id = p.id
        WHERE pt.merchant_id = p_merchant_id AND pt.created_at::date BETWEEN p_start AND p_end GROUP BY 1
    ),
    combined_cogs AS (
        SELECT day, SUM(cogs) as cogs FROM (SELECT day, cogs FROM web_cogs_daily UNION ALL SELECT day, cogs FROM pos_cogs_daily) t GROUP BY 1
    )
    SELECT json_agg(json_build_object(
        'date', ds.day,
        'revenue', COALESCE(r.revenue, 0),
        'profit', COALESCE(r.revenue, 0) - COALESCE(c.cogs, 0)
    ) ORDER BY ds.day)
    INTO v_daily_stats
    FROM daily_series ds
    LEFT JOIN combined_revenue r ON ds.day = r.day
    LEFT JOIN combined_cogs c ON ds.day = c.day;

    -- 8. Top Products (Combined)
    SELECT COALESCE(json_agg(t), '[]'::json)
    INTO v_top_products
    FROM (
        SELECT name, SUM(quantity) as quantity, SUM(revenue) as revenue, SUM(profit) as profit
        FROM (
            SELECT p.name, SUM(oi.quantity) as quantity, SUM(oi.line_total) as revenue, SUM(oi.line_total - (oi.quantity * COALESCE(p.cost_price, 0))) as profit
            FROM order_items oi JOIN products p ON oi.product_id = p.id JOIN orders o ON oi.order_id = o.id
            WHERE o.merchant_id = p_merchant_id AND o.status NOT IN ('pending', 'cancelled')
              AND o.created_at::date BETWEEN p_start AND p_end GROUP BY p.name
            UNION ALL
            SELECT p.name, SUM(pti.qty) as quantity, SUM(pti.line_total_rm) as revenue, SUM(pti.line_total_rm - (pti.qty * COALESCE(p.cost_price, 0))) as profit
            FROM pos_transaction_items pti JOIN products p ON pti.product_id = p.id JOIN pos_transactions pt ON pti.transaction_id = pt.id
            WHERE pt.merchant_id = p_merchant_id AND pt.created_at::date BETWEEN p_start AND p_end GROUP BY p.name
        ) s GROUP BY name ORDER BY revenue DESC LIMIT 5
    ) t;

    -- 9. Recent Orders (Web only, for the specific Web list)
    SELECT COALESCE(json_agg(t), '[]'::json)
    INTO v_recent_orders
    FROM (
        SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at, pr.full_name as customer_name
        FROM orders o LEFT JOIN profiles pr ON o.customer_id = pr.id
        WHERE o.merchant_id = p_merchant_id ORDER BY o.created_at DESC LIMIT 5
    ) t;

    -- 10. System Alerts
    SELECT json_build_object(
        'low_stock_count', (SELECT COUNT(*) FROM products WHERE merchant_id = p_merchant_id AND stock_quantity <= low_stock_alert AND status = 'active'),
        'pending_orders_count', (SELECT COUNT(*) FROM orders WHERE merchant_id = p_merchant_id AND status = 'pending'),
        'open_pos_sessions', (SELECT COUNT(*) FROM pos_sessions WHERE merchant_id = p_merchant_id AND status = 'open')
    ) INTO v_alerts;

    -- 11. Purchase Summary
    SELECT jsonb_build_object(
        'total_spent', COALESCE(SUM(total), 0),
        'po_count', COUNT(*)
    ) INTO v_purchase_summary
    FROM purchase_orders
    WHERE merchant_id = p_merchant_id AND order_date::date BETWEEN p_start AND p_end;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'revenue', v_total_revenue,
            'web_revenue', v_web_revenue,
            'pos_revenue', v_pos_revenue,
            'prev_revenue', v_prev_total_revenue,
            'gross_profit', v_total_revenue - v_total_cogs,
            'prev_gross_profit', v_prev_total_revenue - v_prev_total_cogs,
            'expenses', v_total_expenses,
            'prev_expenses', v_prev_total_expenses,
            'net_pnl', v_net_pnl,
            'prev_net_pnl', v_prev_total_revenue - v_prev_total_cogs - v_prev_total_expenses
        ),
        'trends', COALESCE(v_daily_stats, '[]'::jsonb),
        'top_products', COALESCE(v_top_products, '[]'::jsonb),
        'recent_orders', v_recent_orders,
        'alerts', v_alerts,
        'purchase_summary', v_purchase_summary
    );
END;
$$;
