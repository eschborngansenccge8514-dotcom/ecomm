import { signLazadaRequest } from "./signature";
import { 
  LazadaConfig, 
  LazadaBaseResponse, 
  LazadaSeller, 
  LazadaOrder, 
  LazadaOrderItem 
} from "./types";

export class LazadaClient {
  private config: LazadaConfig;

  constructor(config: LazadaConfig) {
    this.config = config;
  }

  private async fetch<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined | null> = {},
    options: RequestInit = {}
  ): Promise<LazadaBaseResponse<T>> {
    const timestamp = Date.now().toString();
    const commonParams: Record<string, string | number | boolean | undefined | null> = {
      app_key: this.config.appKey,
      timestamp,
      sign_method: "sha256",
      access_token: this.config.accessToken,
    };

    const allParams = { ...commonParams, ...params };
    const sign = signLazadaRequest(path, allParams, this.config.appSecret);

    const url = new URL(`${this.config.baseUrl}${path}`);
    Object.entries(allParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
    url.searchParams.append("sign", sign);

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lazada API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as LazadaBaseResponse<T>;
    if (data.code !== "0") {
      throw new Error(`Lazada API error [${data.code}]: ${data.message || data.request_id}`);
    }

    return data;
  }

  /**
   * Get authorized seller information.
   */
  async getSellerInfo() {
    return this.fetch<LazadaSeller>("/seller/get");
  }

  /**
   * Get orders list.
   */
  async listOrders(params: {
    status?: string;
    created_after?: string;
    created_before?: string;
    update_after?: string;
    update_before?: string;
    offset?: number;
    limit?: number;
    sort_by?: string;
    sort_direction?: string;
  }) {
    return this.fetch<any>("/orders/get", params);
  }

  /**
   * Get specific order details.
   */
  async getOrder(orderId: string | number) {
    return this.fetch<any>("/order/get", { order_id: orderId });
  }

  /**
   * Get order items.
   */
  async getOrderItems(orderId: string | number) {
    return this.fetch<any>("/order/items/get", { order_id: orderId });
  }

  /**
   * Update SKU stock level.
   */
  async updateStock(payload: {
    ItemId: number | string;
    Skus: Array<{
      SellerSku: string;
      Quantity: number;
    }>;
  }) {
    const xml = `<Request><Product><Skus>${payload.Skus.map(s => `<Sku><SellerSku>${s.SellerSku}</SellerSku><Quantity>${s.Quantity}</Quantity></Sku>`).join("")}</Skus></Product></Request>`;
    return this.fetch<any>("/product/stock/update", { payload: xml }, { method: "POST" });
  }

  /**
   * Set order items status to "packed".
   */
  async packOrder(orderItemIds: number[], shippingProvider?: string, deliveryType: string = "dropship") {
    return this.fetch<any>("/order/fulfill/pack", {
      order_item_ids: JSON.stringify(orderItemIds),
      shipping_provider: shippingProvider,
      delivery_type: deliveryType
    }, { method: "POST" });
  }
}
