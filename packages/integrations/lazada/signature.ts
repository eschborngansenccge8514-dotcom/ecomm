import { createHmac } from "node:crypto";

/**
 * Signs a Lazada API request.
 * 
 * @param path The API endpoint path (e.g., "/order/get")
 * @param params All request parameters including common parameters (app_key, timestamp, etc.)
 * @param appSecret The Lazada App Secret
 * @returns The hex-encoded HMAC-SHA256 signature in uppercase
 */
export function signLazadaRequest(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
  appSecret: string
): string {
  // 1. Sort parameters alphabetically by key
  const sortedKeys = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .sort();

  // 2. Concatenate key and value
  const paramString = sortedKeys
    .map((key) => `${key}${params[key]}`)
    .join("");

  // 3. Prepend path to the parameter string
  const baseString = `${path}${paramString}`;

  // 4. Generate HMAC-SHA256 signature
  return createHmac("sha256", appSecret)
    .update(baseString)
    .digest("hex")
    .toUpperCase();
}
