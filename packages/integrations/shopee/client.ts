import { signShopeeRequest } from "./signature.ts";

export interface ShopeeClientConfig {
  partnerId: string | number;
  partnerKey: string;
  baseUrl: string;
  accessToken: string;
  shopId: string | number;
}

export class ShopeeClient {
  constructor(private config: ShopeeClientConfig) {}

  /**
   * Generates an authenticated Shopee URL with common params and signature.
   */
  private buildUrl(path: string, params: Record<string, string | number> = {}) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = signShopeeRequest({
      partnerId: this.config.partnerId,
      partnerKey: this.config.partnerKey,
      path,
      timestamp,
      accessToken: this.config.accessToken,
      shopId: this.config.shopId,
    });

    const url = new URL(`${this.config.baseUrl.replace(/\/$/, "")}${path}`);
    url.searchParams.set("partner_id", String(this.config.partnerId));
    url.searchParams.set("timestamp", String(timestamp));
    url.searchParams.set("access_token", this.config.accessToken);
    url.searchParams.set("shop_id", String(this.config.shopId));
    url.searchParams.set("sign", sign);

    // Filter out undefined and add custom params
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        url.searchParams.set(k, String(v));
      }
    }
    
    return url.toString();
  }

  /**
   * Fetches Shopee shop information.
   */
  async getShopInfo() {
    const url = this.buildUrl("/api/v2/shop/get_shop_info");
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  /**
   * Lists orders for a given time range.
   */
  async listOrders(params: { timeFrom: number; timeTo: number; orderStatus?: string; pageSize?: number; cursor?: string }) {
    const url = this.buildUrl("/api/v2/order/get_order_list", {
      time_from: params.timeFrom,
      time_to: params.timeTo,
      order_status: params.orderStatus ?? "READY_TO_SHIP",
      page_size: params.pageSize ?? 50,
      cursor: params.cursor ?? "",
    });
    
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  /**
   * Fetches detailed information for a list of orders.
   */
  async getOrderDetails(orderSnList: string[]) {
    const url = this.buildUrl("/api/v2/order/get_order_detail", {
      order_sn_list: orderSnList.join(","),
      response_optional_fields: "buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,goods_to_declare,note,note_update_time,item_list,pay_time,dropshipper,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,cancel_reason,actual_shipping_fee_confirmed,buyer_cpf_id,fulfillment_flag,pickup_done_time,package_list,shipping_carrier,payment_method,shipping_fee_discount,estimated_shipping_fee,total_amount,order_chargeable_weight",
    });
    
    const res = await fetch(url);
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  /**
   * Updates item stock levels in Shopee.
   */
  async updateStock(input: { itemId: number; stock: number; modelId?: number }) {
    const url = this.buildUrl("/api/v2/product/update_stock");
    const payload: any = {
      item_id: input.itemId,
      stock_list: [{
        normal_stock: input.stock
      }]
    };
    
    if (input.modelId) {
      payload.stock_list[0].model_id = input.modelId;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  /**
   * Adds a new item to the shop.
   */
  async createProduct(payload: any) {
    const url = this.buildUrl("/api/v2/product/add_item");
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
    return new Error(`Shopee API Client Error (${res.status}): ${body}`);
  }
}
