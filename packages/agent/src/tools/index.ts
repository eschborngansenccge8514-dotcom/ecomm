import { listOrders, getOrderDetails, cancelOrder,
         updateOrderStatus, bulkMarkReady, searchOrders }  from './orders'
import { getSalesSummary }          from './analytics'
import { comparePerformance, detectAnomalies,
         generateBusinessReport }   from './analytics-advanced'
import { searchKnowledgeBase }      from './knowledge'
import { checkDeliveryRates, createLalamoveBooking,
         createEasyParcelShipment, getShipmentTracking,
         cancelShipment, getFulfillmentSummary }           from './logistics'
import { syncProductListing, updateStockLevel,
         pullMarketplaceOrders, getListingHealth,
         bulkPriceUpdate, syncGoogleMerchant,
         getGoogleMerchantDiagnostics } from './marketplace'
import { createPaymentLink, verifyPaymentStatus,
         processRefund, getPaymentReport,
         listUnpaidOrders }         from './payments'
import { listPendingInvoices, generateEinvoice,
         batchSubmitInvoices, checkLhdnSubmissionStatus,
         generateConsolidatedInvoice }                     from './einvoice'
import { getCustomerProfile, getCustomerSegments,
         awardLoyaltyPoints, processPointRedemption,
         sendLoyaltyNotification }  from './crm'
import { savePlaybook, runPlaybook, listPlaybooks,
         pushDashboardAlert, getMerchantSnapshot }         from './automation'

export const buildTools = (merchantId: string, sessionId: string) => ({
  // Orders (6)
  list_orders:                    listOrders(merchantId, sessionId),
  get_order_details:              getOrderDetails(merchantId, sessionId),
  cancel_order:                   cancelOrder(merchantId, sessionId),
  update_order_status:            updateOrderStatus(merchantId, sessionId),
  bulk_mark_ready:                bulkMarkReady(merchantId, sessionId),
  search_orders:                  searchOrders(merchantId, sessionId),

  // Logistics (6)
  check_delivery_rates:           checkDeliveryRates(merchantId, sessionId),
  create_lalamove_booking:        createLalamoveBooking(merchantId, sessionId),
  create_easyparcel_shipment:     createEasyParcelShipment(merchantId, sessionId),
  get_shipment_tracking:          getShipmentTracking(merchantId, sessionId),
  cancel_shipment:                cancelShipment(merchantId, sessionId),
  get_fulfillment_summary:        getFulfillmentSummary(merchantId, sessionId),

  // Marketplace (7)
  sync_product_listing:           syncProductListing(merchantId, sessionId),
  update_stock_level:             updateStockLevel(merchantId, sessionId),
  pull_marketplace_orders:        pullMarketplaceOrders(merchantId, sessionId),
  get_listing_health:             getListingHealth(merchantId, sessionId),
  bulk_price_update:              bulkPriceUpdate(merchantId, sessionId),
  sync_google_merchant:           syncGoogleMerchant(merchantId, sessionId),
  get_google_merchant_diagnostics: getGoogleMerchantDiagnostics(merchantId, sessionId),

  // Payments (5)
  create_payment_link:            createPaymentLink(merchantId, sessionId),
  verify_payment_status:          verifyPaymentStatus(merchantId, sessionId),
  process_refund:                 processRefund(merchantId, sessionId),
  get_payment_report:             getPaymentReport(merchantId, sessionId),
  list_unpaid_orders:             listUnpaidOrders(merchantId, sessionId),

  // E-Invoicing (5)
  list_pending_invoices:          listPendingInvoices(merchantId, sessionId),
  generate_einvoice:              generateEinvoice(merchantId, sessionId),
  batch_submit_invoices:          batchSubmitInvoices(merchantId, sessionId),
  check_lhdn_submission_status:   checkLhdnSubmissionStatus(merchantId, sessionId),
  generate_consolidated_invoice:  generateConsolidatedInvoice(merchantId, sessionId),

  // CRM & Loyalty (5)
  get_customer_profile:           getCustomerProfile(merchantId, sessionId),
  get_customer_segments:          getCustomerSegments(merchantId, sessionId),
  award_loyalty_points:           awardLoyaltyPoints(merchantId, sessionId),
  process_point_redemption:       processPointRedemption(merchantId, sessionId),
  send_loyalty_notification:      sendLoyaltyNotification(merchantId, sessionId),

  // Analytics (4)
  get_sales_summary:              getSalesSummary(merchantId, sessionId),
  compare_performance:            comparePerformance(merchantId, sessionId),
  detect_anomalies:               detectAnomalies(merchantId, sessionId),
  generate_business_report:       generateBusinessReport(merchantId, sessionId),

  // Automation (5)
  save_playbook:                  savePlaybook(merchantId, sessionId),
  run_playbook:                   runPlaybook(merchantId, sessionId),
  list_playbooks:                 listPlaybooks(merchantId, sessionId),
  push_dashboard_alert:           pushDashboardAlert(merchantId, sessionId),
  get_merchant_snapshot:          getMerchantSnapshot(merchantId, sessionId),

  // Knowledge (1)
  search_knowledge_base:          searchKnowledgeBase
})
