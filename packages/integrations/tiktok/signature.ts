import { createHmac } from "node:crypto";

/**
 * Signs a TikTok Shop API request according to the platform's rules.
 * Sorting parameters, concatenating, and wrapping with app secret.
 */
export function signTikTokRequest(input: {
  appSecret: string;
  path: string;
  params: Record<string, string | number | boolean | undefined>;
}) {
  const { appSecret, path, params } = input;
  
  // 1. Filter and sort parameters
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));

  // 2. Concatenate parameters: k1v1k2v2...
  const base = entries.map(([k, v]) => `${k}${v}`).join("");
  
  // 3. Construct signing string: path + base
  // Note: TikTok v1 used just base, v2 includes path. 
  // Most recent TikTok Open API v2 requires: app_secret + path + sorted_params + app_secret
  const src = `${appSecret}${path}${base}${appSecret}`;

  return createHmac("sha256", appSecret)
    .update(src)
    .digest("hex");
}
