import { getSupabaseClient } from "./supabase.ts";

/**
 * Check if a webhook event has already been received.
 */
export async function isDuplicateEvent(
  provider: string,
  eventKey: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("marketplace_event_dedup")
    .select("created_at")
    .eq("provider", provider)
    .eq("event_key", eventKey)
    .single();

  if (error || !data) return false;
  return true;
}

/**
 * Register a newly received webhook event.
 */
export async function registerEvent(
  provider: string,
  eventKey: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("marketplace_event_dedup").insert({
    provider,
    event_key: eventKey,
    created_at: new Date().toISOString(),
  });

  if (error) throw error;
}
