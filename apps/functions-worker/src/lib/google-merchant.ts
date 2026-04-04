// Simplified Google Merchant Client and Mapping for Cloudflare Worker

export interface GoogleProduct {
  offerId: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  contentLanguage: string;
  targetCountry: string;
  feedLabel: string;
  channel: 'online' | 'local';
  availability: 'in stock' | 'out of stock' | 'preorder' | 'backorder';
  condition: 'new' | 'refurbished' | 'used';
  price: {
    value: string;
    currency: string;
  };
}

export function mapProductToGoogle(product: any, config: { contentLanguage: string, feedLabel: string, baseUrl: string }): GoogleProduct {
  const currency = 'MYR' 
  const availability = product.stock_quantity > 0 ? 'in stock' : 'out of stock'
  
  return {
    offerId: product.sku || product.id,
    title: product.name,
    description: product.description || product.name,
    link: `${config.baseUrl}/products/${product.id}`,
    imageLink: product.images?.[0] || '',
    contentLanguage: config.contentLanguage || 'en',
    targetCountry: 'MY',
    feedLabel: config.feedLabel || 'MY',
    channel: 'online',
    availability,
    condition: 'new',
    price: {
      value: String(product.price),
      currency
    }
  }
}

export class GoogleMerchantClient {
  private accessToken: string;
  private merchantId: string;

  constructor(config: { accessToken: string, merchantId: string }) {
    this.accessToken = config.accessToken;
    this.merchantId = config.merchantId;
  }

  async insertProduct(product: GoogleProduct) {
    const url = `https://shoppingcontent.googleapis.com/content/v2.1/${this.merchantId}/products`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(product)
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`GMC API Error: ${error}`)
    }
    return await res.json()
  }

  async updateAvailability(offerId: string, availability: string) {
    const url = `https://shoppingcontent.googleapis.com/content/v2.1/${this.merchantId}/products/${offerId}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ availability })
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`GMC PATCH Error: ${error}`)
    }
    return await res.json()
  }
}
