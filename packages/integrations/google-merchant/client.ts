export class GoogleMerchantClient {
  private baseUrl = "https://merchantapi.googleapis.com/products/v1";

  constructor(
    private config: {
      accessToken: string;
      merchantId: string;
      dataSourceId: string;
    }
  ) {}

  private get headers() {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json"
    };
  }

  async insertProductInput(payload: GoogleProductInput) {
    const parent = `accounts/${this.config.merchantId}`;
    const dataSource = `${parent}/dataSources/${this.config.dataSourceId}`;
    const url = `${this.baseUrl}/${parent}/productInputs:insert?dataSource=${encodeURIComponent(dataSource)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async deleteProductInput(offerId: string) {
    const parent = `accounts/${this.config.merchantId}`;
    const dataSource = `${parent}/dataSources/${this.config.dataSourceId}`;
    const name = `${parent}/productInputs/${offerId}`;
    const url = `${this.baseUrl}/${name}?dataSource=${encodeURIComponent(dataSource)}`;

    const res = await fetch(url, { method: "DELETE", headers: this.headers });
    if (!res.ok) throw await this.toError(res);
    return res.status === 204 ? { deleted: true } : res.json();
  }

  async getProductStatus(offerId: string) {
    const name = `accounts/${this.config.merchantId}/products/${offerId}`;
    const url = `${this.baseUrl}/${name}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async listProductStatuses(pageToken?: string) {
    const parent = `accounts/${this.config.merchantId}`;
    const url = new URL(`${this.baseUrl}/${parent}/products`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  async getAccountStatus() {
    const url = `https://shoppingcontent.googleapis.com/content/v2.1/${this.config.merchantId}/accountstatuses/${this.config.merchantId}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw await this.toError(res);
    return res.json();
  }

  private async toError(res: Response) {
    const body = await res.text();
    return new Error(`Google Merchant API error ${res.status}: ${body}`);
  }
}

export interface GoogleProductInput {
  offerId: string;
  contentLanguage: string;
  feedLabel: string;
  productAttributes: {
    title: string;
    description: string;
    link: string;
    imageLink: string;
    availability: "IN_STOCK" | "OUT_OF_STOCK" | "PREORDER";
    price: { amountMicros: string; currencyCode: string };
    condition: "NEW" | "REFURBISHED" | "USED";
    brand?: string;
    gtins?: string[];
    mpn?: string;
    googleProductCategory?: string;
    color?: string;
    sizes?: string[];
  };
}
