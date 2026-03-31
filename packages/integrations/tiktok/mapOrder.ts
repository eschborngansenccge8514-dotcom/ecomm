/**
 * Maps a TikTok Shop order to the canonical platform order format.
 */
export function mapTikTokOrderToPlatform(raw: any) {
  const order = raw.data || raw; // If multiple formats are returned
  
  return {
    external_order_id: order.order_id,
    external_order_sn: order.order_id,
    
    status: mapTikTokStatusToPlatform(order.order_status),
    
    total_amount: order.payment?.total_amount,
    currency: order.payment?.currency || "MYR",
    
    buyer_username: order.buyer_email, // TikTok provides email/username
    shipping_address: {
      full_name: order.recipient_address?.full_name,
      phone: order.recipient_address?.phone,
      address: [
        order.recipient_address?.address_line1,
        order.recipient_address?.address_line2,
        order.recipient_address?.district,
        order.recipient_address?.city,
        order.recipient_address?.state,
        order.recipient_address?.zip_code
      ].filter(Boolean).join(", "),
    },
    
    items: (order.line_items || []).map((item: any) => ({
      external_item_id: item.sku_id,
      product_name: item.product_name,
      sku: item.seller_sku,
      quantity: item.quantity,
      price: item.sale_price,
    })),
    
    metadata: {
      tiktok_order_id: order.order_id,
      tiktok_status: order.order_status,
      tracking_number: order.tracking_number,
      shipping_provider: order.shipping_provider_name
    }
  };
}

/**
 * Maps TikTok Shop order statuses to platform-agnostic statuses.
 */
function mapTikTokStatusToPlatform(tiktokStatus: string): string {
  switch (tiktokStatus) {
    case "UNPAID": return "pending_payment";
    case "AWAITING_SHIPMENT": return "preparing";
    case "AWAITING_COLLECTION": return "ready_for_pickup";
    case "SHIPPED": return "shipped";
    case "DELIVERED": return "delivered";
    case "COMPLETED": return "completed";
    case "CANCELLED": return "cancelled";
    default: return "unknown";
  }
}
