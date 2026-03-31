export interface LazadaConfig {
  appKey: string;
  appSecret: string;
  baseUrl: string;
  accessToken?: string;
}

export interface LazadaBaseResponse<T = any> {
  code: string;
  type: string;
  message?: string;
  request_id: string;
  data?: T;
}

export interface LazadaSeller {
  name: string;
  short_code: string;
  seller_id: number;
  email: string;
}

export interface LazadaOrder {
  order_id: number;
  customer_first_name: string;
  customer_last_name: string;
  payment_method: string;
  price: string;
  items_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  address_billing: any;
  address_shipping: any;
}

export interface LazadaOrderItem {
  order_item_id: number;
  shop_id: string;
  order_id: number;
  sku: string;
  shop_sku: string;
  name: string;
  item_price: number;
  paid_price: number;
  currency: string;
  status: string;
}
