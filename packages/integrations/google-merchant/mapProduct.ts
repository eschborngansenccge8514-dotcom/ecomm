import type { GoogleProductInput } from "./client.ts";

export function mapProductToGoogle(
  product: any,
  config: {
    contentLanguage: string;
    feedLabel: string;
    baseUrl: string;
  }
): GoogleProductInput {
  return {
    offerId: product.sku,
    contentLanguage: config.contentLanguage,
    feedLabel: config.feedLabel,
    productAttributes: {
      title: product.name,
      description: stripHtml(product.description),
      link: `${config.baseUrl}/products/${product.sku}`, // Assuming SKU is better for unique identification
      imageLink: product.images?.[0] ?? "",
      availability: product.stock_quantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
      price: {
        amountMicros: String(Math.round(product.price * 1_000_000)),
        currencyCode: product.currency ?? "MYR"
      },
      condition: "NEW",
      brand: product.metadata?.brand ?? undefined,
      gtins: product.metadata?.gtin ? [product.metadata.gtin] : undefined,
      mpn: product.metadata?.mpn ?? undefined,
      googleProductCategory: product.metadata?.google?.category ?? undefined
    }
  };
}

export function stripHtml(html: string) {
  return html?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ?? "";
}
