import { getSupabaseClient } from "./supabase.ts";
import { decryptJson, encryptJson } from "./crypto.ts";

export interface MarketplaceCredential {
  id: string;
  tenant_id: string;
  marketplace_account_id: string;
  credential_type: string;
  encrypted_payload: string;
  expires_at: string | null;
  is_active: boolean;
}

/**
 * Load and decrypt the active credential for a marketplace account.
 * Automatically handles decryption using the APP_ENCRYPTION_KEY_BASE64.
 */
export async function getActiveCredential<T>(
  accountId: string,
  credentialType: string = "oauth_token"
): Promise<{ credential: MarketplaceCredential; payload: T } | null> {
  const supabase = getSupabaseClient();
  const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64");

  if (!encryptionKey) {
    throw new Error("Missing APP_ENCRYPTION_KEY_BASE64");
  }

  const { data, error } = await supabase
    .from("marketplace_credentials")
    .select("*")
    .eq("marketplace_account_id", accountId)
    .eq("credential_type", credentialType)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  const payload = await decryptJson<T>(data.encrypted_payload, encryptionKey);
  return { credential: data, payload };
}

/**
 * Update a credential with a new payload and expiry.
 * Automatically encrypts the payload.
 */
export async function updateCredential(
  credentialId: string,
  payload: any,
  expiresAt: string | null = null
): Promise<void> {
  const supabase = getSupabaseClient();
  const encryptionKey = Deno.env.get("APP_ENCRYPTION_KEY_BASE64");

  if (!encryptionKey) {
    throw new Error("Missing APP_ENCRYPTION_KEY_BASE64");
  }

  const encryptedPayload = await encryptJson(payload, encryptionKey);

  const { error } = await supabase
    .from("marketplace_credentials")
    .update({
      encrypted_payload: encryptedPayload,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", credentialId);

  if (error) throw error;
}
