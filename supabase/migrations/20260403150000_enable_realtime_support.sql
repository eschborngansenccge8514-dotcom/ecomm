-- Enable realtime for support_sessions and support_messages
-- This allows the merchant dashboard SupportInboxClient to receive live updates

-- Enable replica identity
ALTER TABLE "public"."support_sessions" REPLICA IDENTITY FULL;
ALTER TABLE "public"."support_messages" REPLICA IDENTITY FULL;

-- Check if publication exists, otherwise create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."support_sessions";
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."support_messages";

-- (Optional) If we also want the main agent chat to have realtime features just in case:
-- ALTER TABLE "public"."agent_sessions" REPLICA IDENTITY FULL;
-- ALTER TABLE "public"."agent_messages" REPLICA IDENTITY FULL;
-- ALTER PUBLICATION supabase_realtime ADD TABLE "public"."agent_sessions";
-- ALTER PUBLICATION supabase_realtime ADD TABLE "public"."agent_messages";
