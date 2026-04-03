import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'

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

// Tool 1: Check rates from both couriers — low risk
export const checkDeliveryRates = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get delivery rate quotes from Lalamove and EasyParcel for one or more orders. Always call this before booking to find the cheapest option.',
    parameters: z.object({
      order_ids: z.array(z.string()).min(1)
                  .describe('One or more order IDs to get rates for'),
      couriers:  z.array(z.enum(['lalamove', 'easyparcel'])).default(['lalamove', 'easyparcel'])
                  .describe('Which couriers to get quotes from')
    }),
    execute: (input: any) =>
      executeWithGuard('check_delivery_rates', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('get-delivery-quotes', { ...input, merchant_id: merchantId, mode: 'merchant' }))
  } as any)

// Tool 2: Book Lalamove on-demand delivery — high risk
export const createLalamoveBooking = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Book an on-demand delivery via Lalamove for an order. Only use after checking rates. Best for same-day or urgent local deliveries.',
    parameters: z.object({
      order_id:     z.string(),
      service_type: z.enum(['MOTORCYCLE', 'CAR', 'VAN', 'TRUCK']).default('MOTORCYCLE'),
      priority_fee: z.number().optional()
                    .describe('Additional priority fee in RM — only include if merchant explicitly requested priority')
    }),
    execute: (input: any) =>
      executeWithGuard('create_lalamove_booking', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Book Lalamove for Order #${i.order_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to book a Lalamove ${i.service_type} delivery for order #${i.order_id}.` +
          (i.priority_fee ? ` Priority fee: RM${i.priority_fee}.` : '')
      }, merchantId, sessionId,
        () => edgeCall('lalamove-create-order', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 3: Book EasyParcel courier shipment — high risk
export const createEasyParcelShipment = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Book a courier shipment via EasyParcel for an order. Best for standard parcel deliveries. Only use after checking rates.',
    parameters: z.object({
      order_id:     z.string(),
      courier_id:   z.string()
                    .describe('Courier code returned by check_delivery_rates e.g. "GDEX", "POSLAJU", "JANDT"'),
      weight_kg:    z.number().min(0.1)
                    .describe('Parcel weight in kilograms'),
      dimensions:   z.object({
        length_cm: z.number(),
        width_cm:  z.number(),
        height_cm: z.number()
      }).optional()
    }),
    execute: (input: any) =>
      executeWithGuard('create_easyparcel_shipment', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Book EasyParcel Shipment for Order #${i.order_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to book ${i.courier_id} via EasyParcel for order #${i.order_id} (${i.weight_kg}kg).`
      }, merchantId, sessionId,
        () => edgeCall('easyparcel-create-order', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 4: Get tracking status — low risk
export const getShipmentTracking = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get real-time tracking status for one or more shipments by order ID or tracking number.',
    parameters: z.object({
      identifiers: z.array(z.string()).min(1)
                    .describe('Order IDs or tracking numbers'),
      id_type:     z.enum(['order_id', 'tracking_number']).default('order_id')
    }),
    execute: (input: any) =>
      executeWithGuard('get_shipment_tracking', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('track-shipment', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 5: Cancel shipment — high risk
export const cancelShipment = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Cancel an active shipment booking. Only possible before the courier picks up the parcel.',
    parameters: z.object({
      order_id: z.string(),
      reason:   z.string()
    }),
    execute: (input: any) =>
      executeWithGuard('cancel_shipment', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) => `Cancel Shipment for Order #${i.order_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to cancel the active shipment for order #${i.order_id}. Reason: ${i.reason}`
      }, merchantId, sessionId,
        () => edgeCall('cancel-shipment', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 6: Fulfillment summary — low risk
export const getFulfillmentSummary = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get aggregated fulfillment metrics: total shipments, on-time rate, courier breakdown, and average delivery cost for a period.',
    parameters: z.object({
      period: z.enum(['today', 'this_week', 'last_week', 'this_month', 'last_month'])
    }),
    execute: (input: any) =>
      executeWithGuard('get_fulfillment_summary', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('fulfillment-summary', { ...input, merchant_id: merchantId }))
  } as any)
