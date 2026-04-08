-- Migration: 20260409000001_customer_timeline_rpc.sql
-- Description: Create get_customer_activity_timeline RPC to unify customer events

CREATE OR REPLACE FUNCTION get_customer_activity_timeline(
    p_customer_id UUID,
    p_merchant_id UUID,
    p_customer_email TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
    event_date TIMESTAMPTZ,
    event_type TEXT,
    event_title TEXT,
    event_desc TEXT,
    event_icon TEXT,
    event_color TEXT,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- 1. Orders
    SELECT 
        created_at AS event_date,
        'Purchase'::TEXT AS event_type,
        ('Order #' || order_number || ' ' || status) AS event_title,
        ('Purchased items worth RM ' || total_amount) AS event_desc,
        'Package'::TEXT AS event_icon,
        'bg-blue-500'::TEXT AS event_color,
        jsonb_build_object('order_id', id, 'order_number', order_number, 'status', status) AS metadata
    FROM orders
    WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id

    UNION ALL

    -- 2. Reviews
    SELECT 
        created_at AS event_date,
        'Review'::TEXT AS event_type,
        ('Left ' || rating || '-star Review') AS event_title,
        comment AS event_desc,
        'Star'::TEXT AS event_icon,
        'bg-amber-400'::TEXT AS event_color,
        jsonb_build_object('review_id', id, 'rating', rating) AS metadata
    FROM order_reviews
    WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id

    UNION ALL

    -- 3. Support Sessions (linked by email)
    SELECT 
        created_at AS event_date,
        'Support'::TEXT AS event_type,
        ('Support Session ' || status) AS event_title,
        'Customer support interaction' AS event_desc,
        'ShieldCheck'::TEXT AS event_icon,
        'bg-emerald-500'::TEXT AS event_color,
        jsonb_build_object('session_id', id, 'status', status) AS metadata
    FROM support_sessions
    WHERE (customer_email = p_customer_email AND merchant_id = p_merchant_id) 
       OR (customer_email = p_customer_email AND merchant_id IS NULL) -- Platform level support

    UNION ALL

    -- 4. Loyalty Points update
    SELECT 
        created_at AS event_date,
        'Loyalty'::TEXT AS event_type,
        'Loyalty Points Updated' AS event_title,
        'Customer points record created/updated' AS event_desc,
        'Zap'::TEXT AS event_icon,
        'bg-violet-500'::TEXT AS event_color,
        jsonb_build_object('id', id) AS metadata
    FROM loyalty_points
    WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id

    UNION ALL

    -- 5. Email Logs
    SELECT 
        created_at AS event_date,
        'Email'::TEXT AS event_type,
        ('Email ' || status || ': ' || template) AS event_title,
        ('Sent to ' || recipient) AS event_desc,
        'Mail'::TEXT AS event_icon,
        'bg-slate-400'::TEXT AS event_color,
        jsonb_build_object('resend_id', resend_id, 'template', template, 'status', status) AS metadata
    FROM email_logs
    WHERE recipient = p_customer_email AND merchant_id = p_merchant_id

    UNION ALL

    -- 6. WhatsApp Messages
    SELECT 
        created_at AS event_date,
        'Message'::TEXT AS event_type,
        ('WhatsApp ' || direction) AS event_title,
        message_content AS event_desc,
        'Zap'::TEXT AS event_icon, -- Using zap as a generic messaging icon if MessageSquare isn't available
        'bg-green-500'::TEXT AS event_color,
        jsonb_build_object('id', id, 'status', status, 'direction', direction) AS metadata
    FROM whatsapp_messages
    WHERE (recipient_number = p_customer_phone OR sender_number = p_customer_phone) 
      AND merchant_id = p_merchant_id

    ORDER BY event_date DESC;
END;
$$;
