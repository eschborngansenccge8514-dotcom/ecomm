-- Migration: 20260409000002_fix_timeline_rpc_robustness.sql
-- Description: Robustness fixes for get_customer_activity_timeline RPC

DROP FUNCTION IF EXISTS get_customer_activity_timeline(UUID, UUID, TEXT, TEXT);

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
        COALESCE('Order #' || order_number || ' ' || status, 'Order Updated') AS event_title,
        COALESCE('Purchased items worth RM ' || total_amount, 'Order records updated') AS event_desc,
        'Package'::TEXT AS event_icon,
        'bg-blue-500'::TEXT AS event_color,
        jsonb_build_object('order_id', id, 'order_number', order_number, 'status', status) AS metadata
    FROM public.orders
    WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id

    UNION ALL

    -- 2. Reviews
    SELECT 
        created_at AS event_date,
        'Review'::TEXT AS event_type,
        COALESCE('Left ' || rating || '-star Review', 'Review Posted') AS event_title,
        COALESCE(comment, 'The customer didn''t leave a written review.') AS event_desc,
        'Star'::TEXT AS event_icon,
        'bg-amber-400'::TEXT AS event_color,
        jsonb_build_object('review_id', id, 'rating', rating) AS metadata
    FROM public.order_reviews
    WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id

    UNION ALL

    -- 3. Support Sessions (linked by email)
    SELECT 
        created_at AS event_date,
        'Support'::TEXT AS event_type,
        COALESCE('Support Session ' || status, 'Support Session') AS event_title,
        'Customer support interaction' AS event_desc,
        'ShieldCheck'::TEXT AS event_icon,
        'bg-emerald-500'::TEXT AS event_color,
        jsonb_build_object('session_id', id, 'status', status) AS metadata
    FROM public.support_sessions
    WHERE (customer_email IS NOT NULL AND customer_email = p_customer_email AND merchant_id = p_merchant_id) 
       OR (customer_email IS NOT NULL AND customer_email = p_customer_email AND merchant_id IS NULL)

    UNION ALL

    -- 4. Loyalty Points update
    SELECT 
        updated_at AS event_date,
        'Loyalty'::TEXT AS event_type,
        'Loyalty Points Updated' AS event_title,
        'Customer points record created/updated' AS event_desc,
        'Zap'::TEXT AS event_icon,
        'bg-violet-500'::TEXT AS event_color,
        jsonb_build_object('id', id) AS metadata
    FROM public.loyalty_points
    WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id

    UNION ALL

    -- 5. Email Logs
    SELECT 
        created_at AS event_date,
        'Email'::TEXT AS event_type,
        COALESCE('Email ' || status || ': ' || template, 'Email Communication') AS event_title,
        COALESCE('Sent to ' || recipient, 'Communication sent') AS event_desc,
        'Mail'::TEXT AS event_icon,
        'bg-slate-400'::TEXT AS event_color,
        jsonb_build_object('resend_id', resend_id, 'template', template, 'status', status) AS metadata
    FROM public.email_logs
    WHERE (recipient IS NOT NULL AND recipient = p_customer_email AND merchant_id = p_merchant_id)

    UNION ALL

    -- 6. WhatsApp Messages
    SELECT 
        created_at AS event_date,
        'Message'::TEXT AS event_type,
        COALESCE('WhatsApp ' || direction, 'WhatsApp Message') AS event_title,
        COALESCE(message_content, 'Media or template message') AS event_desc,
        'Zap'::TEXT AS event_icon,
        'bg-green-500'::TEXT AS event_color,
        jsonb_build_object('id', id, 'status', status, 'direction', direction) AS metadata
    FROM public.whatsapp_messages
    WHERE (p_customer_phone IS NOT NULL AND (recipient_number = p_customer_phone OR sender_number = p_customer_phone))
      AND merchant_id = p_merchant_id

    ORDER BY event_date DESC;
END;
$$;

-- Grant execution permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION get_customer_activity_timeline TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_activity_timeline TO anon;
GRANT EXECUTE ON FUNCTION get_customer_activity_timeline TO service_role;
