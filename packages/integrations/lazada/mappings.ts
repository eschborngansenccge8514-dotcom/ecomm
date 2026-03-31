/**
 * Maps an internal product object to a Lazada create_product payload.
 * 
 * @param product The internal product object (from public.products)
 * @param categoryId The Lazada category ID
 * @param variants Optional list of product variants (from public.product_variants)
 */
export function mapProductToLazada(product: any, categoryId: number, variants: any[] = []) {
  const skus = variants.length > 0 
    ? variants.map((v: any) => ({
        SellerSku: v.sku || `${product.id}-${v.id.split("-")[0]}`,
        quantity: v.stock_quantity || 0,
        price: v.price || product.price || 0,
        package_height: v.height || product.height || 10,
        package_length: v.length || product.length || 10,
        package_width: v.width || product.width || 10,
        package_weight: v.weight || product.weight || 0.5,
      }))
    : [{
        SellerSku: product.sku || `${product.id.split("-")[0]}`,
        quantity: product.stock_quantity || 0,
        price: product.price || 0,
        package_height: product.height || 10,
        package_length: product.length || 10,
        package_width: product.width || 10,
        package_weight: product.weight || 0.5,
      }];

  return {
    PrimaryCategory: categoryId,
    SPUId: "",
    Attributes: {
      name: product.name,
      short_description: product.description,
      brand: "No Brand",
      model: product.model || "Default",
    },
    Skus: {
      Sku: skus
    }
  };
}

/**
 * Maps a Lazada order object to the canonical internal order structure.
 * 
 * @param lazadaOrder The raw order object from Lazada /order/get
 */
export function mapLazadaOrderToCanonical(lazadaOrder: any) {
  return {
    external_order_id: String(lazadaOrder.order_id),
    external_order_sn: String(lazadaOrder.order_number || lazadaOrder.order_id),
    status: lazadaOrder.statuses?.[0] || lazadaOrder.status || "pending",
    currency: lazadaOrder.currency || "MYR",
    total_amount: parseFloat(lazadaOrder.price || "0"),
    buyer_username: `${lazadaOrder.customer_first_name || ""} ${lazadaOrder.customer_last_name || ""}`.trim(),
    recipient_address: {
      name: `${lazadaOrder.address_shipping?.first_name || ""} ${lazadaOrder.address_shipping?.last_name || ""}`.trim(),
      phone: lazadaOrder.address_shipping?.phone || lazadaOrder.address_shipping?.phone2,
      full_address: [
        lazadaOrder.address_shipping?.address1,
        lazadaOrder.address_shipping?.address2,
        lazadaOrder.address_shipping?.address3,
        lazadaOrder.address_shipping?.city,
        lazadaOrder.address_shipping?.post_code,
        lazadaOrder.address_shipping?.country
      ].filter(Boolean).join(", "),
      zip_code: lazadaOrder.address_shipping?.post_code
    },
    raw_payload: lazadaOrder
  };
}

/**
 * Maps Lazada order items to the canonical internal order item structure.
 * 
 * @param items Array of order items from Lazada /order/items/get
 */
export function mapLazadaItemsToCanonical(items: any[]) {
  return items.map((item: any) => ({
    external_item_id: String(item.order_item_id),
    external_model_id: String(item.sku_id || ""),
    sku: item.sku,
    title: item.name,
    quantity: 1, // Lazada items are usually returned individually
    price: parseFloat(item.item_price || "0"),
  }));
}
