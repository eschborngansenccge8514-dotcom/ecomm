import { signTikTokRequest } from "./signature.ts";

export class TikTokClient {
  private appKey: string;
  private appSecret: string;
  private baseUrl: string;
  private accessToken: string;
  private shopId: string;

  constructor(config: {
    appKey: string;
    appSecret: string;
    baseUrl?: string;
    accessToken: string;
    shopId: string;
  }) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;
    this.baseUrl = config.baseUrl || "https://open-api.tiktokglobalshop.com";
    this.accessToken = config.accessToken;
    this.shopId = config.shopId;
  }

  /**
   * Internal helper to build an authenticated request URL.
   */
  private buildUrl(path: string, params: Record<string, string | number | boolean | undefined>) {
    const timestamp = Math.floor(Date.now() / 1000);
    const commonParams = {
      app_key: this.appKey,
      timestamp,
      access_token: this.accessToken,
      shop_id: this.shopId,
      sign_method: "hmac-sha256",
    };

    const allParams = { ...commonParams, ...params };
    const sign = signTikTokRequest({
      appSecret: this.appSecret,
      path,
      params: allParams,
    });

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(allParams)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    url.searchParams.set("sign", sign);
    return url.toString();
  }

  /**
   * Gets basic shop information.
   */
  async getShopInfo() {
    const url = this.buildUrl("/api/shop/get_shop_info", {});
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  /**
   * List orders within a time range.
   */
  async listOrders(params: { createTimeFrom: number; createTimeTo: number; pageSize?: number; pageToken?: string }) {
    const url = this.buildUrl("/api/order/search", {
      create_time_from: params.createTimeFrom,
      create_time_to: params.createTimeTo,
      page_size: params.pageSize || 20,
      page_token: params.pageToken,
    });
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  /**
   * Retrieves detailed information for a specific order.
   */
  async getOrderDetail(orderId: string) {
    const url = this.buildUrl("/api/order/detail", { order_id: orderId });
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  /**
   * Updates product details.
   */
  async createOrUpdateProduct(payload: unknown) {
    const url = this.buildUrl("/api/product/save", {});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  /**
   * Confirms shipment for an order.
   */
  async shipOrder(payload: { order_id: string; tracking_number: string; shipping_provider: string }) {
    const url = this.buildUrl("/api/order/ship", {});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  private async toError(res: Response) {
    const body = await res.text();
    return new Error(`TikTok API error ${res.status}: ${body}`);
  }
}
