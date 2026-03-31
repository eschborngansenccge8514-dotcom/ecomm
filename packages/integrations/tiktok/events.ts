/**
 * Determines the platform job type based on a TikTok Shop webhook event.
 */
export function routeTikTokEvent(event: any) {
  const type = event.type || event.event_type;
  
  switch (type) {
    case "ORDER_STATUS_CHANGE":
    case "PACKAGE_UPDATE":
    case "CANCELLATION_STATUS_CHANGE":
    case "RETURN_STATUS_CHANGE":
    case "REVERSE_STATUS_UPDATE":
      return { 
        jobType: "sync_orders", 
        payload: { 
          external_order_id: event.data?.order_id, 
          reason: type 
        } 
      };

    case "PRODUCT_INFORMATION_CHANGE":
    case "PRODUCT_STATUS_CHANGE":
    case "PRODUCT_AUDIT_STATUS_CHANGE":
      return { 
        jobType: "sync_products", 
        payload: { 
          external_product_id: event.data?.product_id, 
          reason: type 
        } 
      };

    case "SELLER_DEAUTHORIZATION":
      return { 
        jobType: "deauthorize_account", 
        payload: { 
          reason: "User revoked permission" 
        } 
      };

    case "UPCOMING_AUTHORIZATION_EXPIRATION":
      return { 
        jobType: "refresh_credentials", 
        payload: { 
          reason: "Token expires soon" 
        } 
      };

    default:
      return { 
        jobType: "sync_diagnostics", 
        payload: { 
          event: type, 
          reason: "Unhandled event type" 
        } 
      };
  }
}
