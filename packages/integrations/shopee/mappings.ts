/**
 * Maps an internal product object to a Shopee add_item payload.
 */
export function mapProductToShopee(product: any, categoryId: number) {
  return {
    item_name: product.name,
    description: product.description,
    category_id: categoryId,
    brand: {
        brand_id: 0, // Default to No Brand
        original_brand_name: "No Brand"
    },
    images: {
      image_url_list: product.images?.map((img: any) => img.url) || []
    },
    item_status: "NORMAL",
    original_price: product.price,
    normal_stock: product.stock_on_hand || 0,
    weight: product.weight || 0.5,
    logistic_info: [
      {
        logistic_id: 0, // Should be fetched from get_channel_list
        enabled: true
      }
    ],
    // Logistics, attributes etc. can be added here
  };
}

/**
 * Maps a Shopee order object to the canonical internal order structure.
 */
export function mapShopeeOrderToCanonical(shopeeOrder: any) {
  return {
    external_order_id: shopeeOrder.order_sn,
    external_order_sn: shopeeOrder.order_sn,
    status: shopeeOrder.order_status, // READY_TO_SHIP, PROCESSED, SHIPPED, etc.
    currency: shopeeOrder.currency,
    total_amount: shopeeOrder.total_amount,
    buyer_username: shopeeOrder.buyer_username,
    recipient_address: {
        name: shopeeOrder.recipient_address?.name,
        phone: shopeeOrder.recipient_address?.phone,
        full_address: shopeeOrder.recipient_address?.full_address,
        zip_code: shopeeOrder.recipient_address?.zip_code
    },
    items: shopeeOrder.item_list?.map((item: any) => ({
      external_item_id: item.item_id,
      external_model_id: item.model_id,
      sku: item.model_sku,
      title: item.item_name,
      quantity: item.model_quantity_purchased,
      price: item.model_discounted_price,
    })) || [],
    raw_payload: shopeeOrder
  };
}
