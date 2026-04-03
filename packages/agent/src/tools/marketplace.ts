import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard, withRetry } from '../middleware/executor'

function edgeCall(path: string, body: object) {
  return fetch(`${process.env.SUPABASE_URL}/functions/v1/${path}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify(body)
  }).then(r => r.json())
}

// Tool 1: Sync a product listing to one or more marketplaces — medium risk
export const syncProductListing = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Push product updates (title, description, images, price, category) to one or more marketplaces. Use this when the merchant wants to update a listing on Shopee, Lazada, or TikTok Shop.',
    parameters: z.object({
      product_id:   z.string().describe('Internal product ID'),
      marketplaces: z.array(z.enum(['shopee', 'lazada', 'tiktok', 'google_merchant']))
                     .min(1).describe('Target marketplaces to push to'),
      fields:       z.array(z.enum(['title', 'description', 'price', 'images', 'category', 'all']))
                     .default(['all']).describe('Which fields to sync — use "all" to sync everything')
    }),
    execute: (input: any) =>
      executeWithGuard('sync_product_listing', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => withRetry(
          () => edgeCall('sync-product-listing', { ...input, merchant_id: merchantId }),
          { maxRetries: 2, retryDelayMs: 1000, fallbackValue: { error: 'marketplace_api_unavailable', message: 'Marketplace sync service is temporarily unavailable.' } }
        ))
  } as any)

// Tool 2: Update stock level across marketplaces — medium risk
export const updateStockLevel = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Update inventory quantity for a product on one or more marketplaces. Use this to keep stock levels in sync after warehouse changes.',
    parameters: z.object({
      product_id:   z.string(),
      quantity:     z.number().int().min(0)
                    .describe('New stock quantity — use 0 to mark as out of stock'),
      marketplaces: z.array(z.enum(['shopee', 'lazada', 'tiktok', 'google_merchant']))
                    .default(['shopee', 'lazada', 'tiktok'])
    }),
    execute: (input: any) =>
      executeWithGuard('update_stock_level', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => withRetry(
          () => edgeCall('update-stock-level', { ...input, merchant_id: merchantId }),
          { maxRetries: 2, retryDelayMs: 1000, fallbackValue: { error: 'inventory_api_unavailable', message: 'Inventory sync service is temporarily unavailable.' } }
        ))
  } as any)

// Tool 3: Pull new orders from a marketplace — low risk
export const pullMarketplaceOrders = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Ingest new orders from a marketplace into the dashboard. Run this to fetch orders that have not yet been synced.',
    parameters: z.object({
      marketplace: z.enum(['shopee', 'lazada', 'tiktok', 'all']).default('all'),
      since:       z.string().optional()
                   .describe('ISO datetime — only pull orders after this time. Defaults to last sync time.')
    }),
    execute: (input: any) =>
      executeWithGuard('pull_marketplace_orders', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => withRetry(
          () => edgeCall('pull-marketplace-orders', { ...input, merchant_id: merchantId }),
          { maxRetries: 1, retryDelayMs: 500, fallbackValue: { error: 'order_sync_unavailable', message: 'Order sync service is temporarily unavailable.' } }
        ))
  } as any)

// Tool 4: Get listing health report — low risk
export const getListingHealth = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Check all product listings for issues such as missing fields, rejected listings, low stock warnings, or price inconsistencies across marketplaces.',
    parameters: z.object({
      marketplace: z.enum(['shopee', 'lazada', 'tiktok', 'all']).default('all'),
      issue_type:  z.array(z.enum(['missing_fields', 'rejected', 'low_stock', 'price_inconsistency', 'all']))
                   .default(['all'])
    }),
    execute: (input: any) =>
      executeWithGuard('get_listing_health', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => withRetry(
          () => edgeCall('listing-health', { ...input, merchant_id: merchantId }),
          { maxRetries: 1, retryDelayMs: 500, fallbackValue: { error: 'diagnostics_unavailable', message: 'Listing health service is temporarily unavailable.' } }
        ))
  } as any)

// Tool 5: Bulk price update — high risk
export const bulkPriceUpdate = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Update prices for multiple products across marketplaces in one operation. Use only when the merchant explicitly provides the product IDs and new prices.',
    parameters: z.object({
      updates: z.array(z.object({
        product_id: z.string(),
        new_price:  z.number().positive().describe('New price in RM')
      })).min(1).max(100),
      marketplaces: z.array(z.enum(['shopee', 'lazada', 'tiktok']))
                    .default(['shopee', 'lazada', 'tiktok'])
    }),
    execute: (input: any) =>
      executeWithGuard('bulk_price_update', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Bulk Price Update — ${i.updates.length} product(s) on ${i.marketplaces.join(', ')}`,
        approvalDescription: (i: any) => {
          const preview = (i.updates as any[]).slice(0, 3)
            .map((u: any) => `${u.product_id} → RM${u.new_price}`)
            .join(', ')
          return `Agent wants to update prices for ${i.updates.length} product(s): ${preview}${i.updates.length > 3 ? '…' : ''}`
        }
      }, merchantId, sessionId,
        () => withRetry(
          () => edgeCall('bulk-price-update', { ...input, merchant_id: merchantId }),
          { maxRetries: 2, retryDelayMs: 1500 }
        ))
  } as any)

// Tool 6: Sync to Google Merchant Center — medium risk
export const syncGoogleMerchant = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Push product listings to Google Merchant Center for Google Shopping ads. Use this to keep Google Shopping inventory in sync with the merchant catalogue.',
    parameters: z.object({
      product_ids:  z.array(z.string()).min(1).optional()
                    .describe('Product IDs to sync — omit to sync all active products'),
      operation:    z.enum(['upsert', 'delete']).default('upsert'),
      target_country: z.enum(['MY', 'SG', 'ID']).default('MY')
                    .describe('Target country for the Google Merchant feed')
    }),
    execute: (input: any) =>
      executeWithGuard('sync_google_merchant', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => withRetry(
          () => edgeCall('sync-google-merchant', { ...input, merchant_id: merchantId }),
          {
            maxRetries:   2,
            retryDelayMs: 1000,
            fallbackValue: { error: 'marketplace_api_unavailable', message: 'Google Merchant Center is temporarily unavailable.' }
          }
        ))
  } as any)

// Tool 7: Get Google Merchant diagnostics — low risk
export const getGoogleMerchantDiagnostics = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Fetch Google Merchant Center product diagnostics — disapproved products, policy violations, missing attributes, and feed health score.',
    parameters: z.object({
      issue_type: z.array(z.enum([
        'disapproved', 'policy_violation', 'missing_attribute',
        'low_quality', 'all'
      ])).default(['all'])
    }),
    execute: (input: any) =>
      executeWithGuard('get_google_merchant_diagnostics', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => withRetry(
          () => edgeCall('google-merchant-diagnostics', { ...input, merchant_id: merchantId }),
          {
            maxRetries:   1,
            retryDelayMs: 500,
            fallbackValue: { error: 'marketplace_api_unavailable', message: 'Diagnostics service is temporarily unavailable.' }
          }
        ))
  } as any)
