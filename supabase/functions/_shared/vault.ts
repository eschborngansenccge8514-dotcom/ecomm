import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export async function upsertSecret(
  supabase: any,
  name:     string,
  secret:   string,
  description?: string
) {
  // Use the vault.create_secret and similar directly via RPC if needed, 
  // but standard Supabase Vault handles this via the `vault` schema.
  // Note: Edge functions using the service role can access the vault schema.
  
  // First, check if secret already exists to update it
  const { data: existing } = await supabase
    .from('secrets')
    .select('id')
    .schema('vault')
    .eq('name', name)
    .maybeSingle();

  if (existing) {
    // Update existing secret
    const { error } = await supabase.rpc('update_secret', {
      secret_id: existing.id,
      new_secret: secret
    });
    if (error) throw error;
    return existing.id;
  } else {
    // Create new secret
    const { data, error } = await supabase.rpc('create_secret', {
      name,
      secret,
      description: description ?? ''
    });
    if (error) throw error;
    return data;
  }
}

export async function getSecret(supabase: any, name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('decrypted_secrets')
    .select('decrypted_secret')
    .schema('vault')
    .eq('name', name)
    .maybeSingle();

  if (error || !data) return null;
  return data.decrypted_secret;
}
