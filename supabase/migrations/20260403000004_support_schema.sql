-- Phase 1: Database Schema for Livechat Customer Support

-- Per-merchant support configuration
CREATE TABLE public.support_configs (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    welcome_message text DEFAULT 'Hello! How can we help you today?',
    business_hours jsonb DEFAULT '{}'::jsonb, -- { mon: {open:"09:00", close:"18:00"}, ... }
    ai_enabled boolean DEFAULT true,
    escalation_email text,
    knowledge_base_text text, -- merchant-provided FAQ/policies
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(merchant_id)
);

-- Customer support conversations
CREATE TABLE public.support_sessions (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_email text,
    customer_name text,
    status text NOT NULL DEFAULT 'open', -- open | escalated | resolved | closed
    is_ai_handling boolean DEFAULT true,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- merchant user who took over
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Messages in support conversations
CREATE TABLE public.support_messages (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    session_id uuid NOT NULL REFERENCES public.support_sessions(id) ON DELETE CASCADE,
    merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL, -- customer | assistant | merchant
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Human escalation requests
CREATE TABLE public.support_escalations (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    session_id uuid NOT NULL REFERENCES public.support_sessions(id) ON DELETE CASCADE,
    merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason text,
    status text NOT NULL DEFAULT 'pending', -- pending | accepted | resolved
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.support_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_escalations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Merchants (Authenticated Users)

-- support_configs: merchants can read/update their own config
CREATE POLICY "Merchants can manage their own support config"
ON public.support_configs
FOR ALL
TO authenticated
USING (merchant_id = auth.uid())
WITH CHECK (merchant_id = auth.uid());

-- support_sessions: merchants can read/update their own sessions
CREATE POLICY "Merchants can manage their own support sessions"
ON public.support_sessions
FOR ALL
TO authenticated
USING (merchant_id = auth.uid())
WITH CHECK (merchant_id = auth.uid());

-- support_messages: merchants can read/insert their own messages
CREATE POLICY "Merchants can manage their own support messages"
ON public.support_messages
FOR ALL
TO authenticated
USING (merchant_id = auth.uid())
WITH CHECK (merchant_id = auth.uid());

-- support_escalations: merchants can manage their own escalations
CREATE POLICY "Merchants can manage their own support escalations"
ON public.support_escalations
FOR ALL
TO authenticated
USING (merchant_id = auth.uid())
WITH CHECK (merchant_id = auth.uid());

-- RLS Policies for Public (Unauthenticated Customers - via API)
-- Note: Customers interact via the API route, but we allow public inserts for anonymous sessions
-- gating by merchant_id should be handled in the API logic as well for security.

CREATE POLICY "Allow public session creation"
ON public.support_sessions
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow public message insertion"
ON public.support_messages
FOR INSERT
TO anon
WITH CHECK (true);

-- Customers should only be able to read their own session/messages if they have the session_id
-- We can add a policy for that if we use Supabase client directly in the widget.
-- For now, we follow the plan which suggests gating by API.

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_support_configs_updated_at
BEFORE UPDATE ON public.support_configs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_support_sessions_updated_at
BEFORE UPDATE ON public.support_sessions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
