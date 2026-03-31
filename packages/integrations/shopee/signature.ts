import { createHmac } from "node:crypto";

/**
 * Generates an HMAC-SHA256 signature for Shopee API requests.
 * @param input.partnerId The Shopee Partner ID.
 * @param input.partnerKey The Shopee Partner Key.
 * @param input.path The API path (e.g. /api/v2/shop/get_shop_info).
 * @param input.timestamp Unix timestamp in seconds.
 * @param input.accessToken Optional access token (for shop/item APIs).
 * @param input.shopId Optional shop ID (for shop/item APIs).
 */
export function signShopeeRequest(input: {
  partnerId: string | number;
  partnerKey: string;
  path: string;
  timestamp: string | number;
  accessToken?: string;
  shopId?: string | number;
}) {
  const { partnerId, partnerKey, path, timestamp, accessToken, shopId } = input;

  let baseString = `${partnerId}${path}${timestamp}`;
  if (accessToken) baseString += accessToken;
  if (shopId) baseString += shopId;

  const hmac = createHmac("sha256", partnerKey);
  hmac.update(baseString, "utf8");
  return hmac.digest("hex");
}
