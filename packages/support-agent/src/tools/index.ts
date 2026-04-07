import { tool } from 'ai'
import { z } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js'

export const buildSupportTools = (
  merchantId: string | null, 
  ownerId: string | null, 
  sessionId: string,
  supabase: SupabaseClient,
  customerId?: string // The authenticated customer's user UUID
) => ({
  /**
   * Find an order by order number.
   * Uses customer_id for secure lookup — no email required.
   */
  lookup_order: tool({
    description: 'Find a specific order by its order number to check status, items, and delivery info.',
    parameters: z.object({
      order_id: z.string().describe('The order number (e.g., ORD-2026-01063 or just 01063)')
    }),
    execute: async ({ order_id }: any) => {
      if (!order_id) return { error: 'Missing order_id' }
      if (!merchantId) return { error: 'Order lookup is not available for platform support.' }
      
      let query = supabase
        .from('orders')
        .select(`
          order_number, status, total_amount, created_at, 
          delivery_status, tracking_number, tracking_url,
          order_items (product_name, quantity, unit_price)
        `)
        .eq('merchant_id', merchantId)
        .eq('order_number', order_id.replace('#', '').trim())
      
      // If we have the customer's ID, scope to their orders for security
      if (customerId) {
        query = query.eq('customer_id', customerId)
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        return { error: 'Failed to retrieve order details.' }
      }
      if (!data) {
        return { error: `Order ${order_id} not found. Please double-check the order number.` }
      }

      return { order: data }
    }
  } as any),

  /**
   * Get shipment tracking details for an order.
   */
  track_shipment: tool({
    description: 'Get real-time tracking information for a shipment.',
    parameters: z.object({
      order_id: z.string().describe('The order number')
    }),
    execute: async ({ order_id }: any) => {
      if (!order_id) return { error: 'Missing order_id' }
      if (!merchantId) return { error: 'Shipment tracking is not available for platform support.' }

      let query = supabase
        .from('orders')
        .select('delivery_status, tracking_number, tracking_url, delivery_provider')
        .eq('merchant_id', merchantId)
        .eq('order_number', order_id.replace('#', '').trim())

      if (customerId) {
        query = query.eq('customer_id', customerId)
      }

      const { data, error } = await query.maybeSingle()

      if (error || !data) return { error: 'Could not find tracking info for this order.' }
      
      return { 
        status: data.delivery_status,
        trackingNumber: data.tracking_number,
        trackingUrl: data.tracking_url,
        provider: data.delivery_provider
      }
    }
  } as any),

  /**
   * Search the merchant's frequently asked questions and policies.
   */
  search_faq: tool({
    description: 'Search the store faq, return policy, and other business policies.',
    parameters: z.object({
      query: z.string().describe('The question or topic to search for')
    }),
    execute: async ({ query }: any) => {
      if (!ownerId) return { message: 'No FAQ information available for platform support.' }
      
      const { data, error } = await supabase
        .from('support_configs')
        .select('knowledge_base_text')
        .eq('merchant_id', ownerId)
        .single()

      if (error || !data?.knowledge_base_text) {
        return { message: 'No FAQ information available for this store.' }
      }

      const keywords = query.toLowerCase().split(' ')
      const paragraphs = data.knowledge_base_text.split('\n\n')
      const matches = paragraphs.filter((p: any) => 
        keywords.some((k: any) => p.toLowerCase().includes(k))
      )

      return { 
        results: matches.length > 0 
          ? matches.slice(0, 3).join('\n\n') 
          : 'I couldn\'t find a specific answer in our policies. Would you like to speak with a human?'
      }
    }
  } as any),

  /**
   * List all recent orders for this customer at this store.
   */
  list_my_orders: tool({
    description: 'List the customer\'s recent orders at this store.',
    parameters: z.object({}),
    execute: async () => {
      if (!merchantId || !customerId) return { error: 'Order list is not available.' }
      const { data, error } = await supabase
        .from('orders')
        .select('order_number, status, total_amount, created_at, delivery_status')
        .eq('merchant_id', merchantId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) return { error: 'Could not retrieve your orders.' }
      if (!data || data.length === 0) return { message: 'No orders found at this store.' }
      return { orders: data }
    }
  } as any),

  /**
   * Submit a return request for an order.
   */
  submit_return_request: tool({
    description: 'Submit a formal request to return a product.',
    parameters: z.object({
      order_id: z.string().describe('The order number'),
      reason: z.string().describe('Reason for the return')
    }),
    execute: async ({ order_id, reason }: any) => {
      if (!order_id) return { error: 'Missing order_id' }
      if (!merchantId) return { error: 'Return requests are not available for platform support.' }

      let query = supabase
        .from('orders')
        .select('id')
        .eq('merchant_id', merchantId)
        .eq('order_number', order_id.replace('#', '').trim())

      if (customerId) {
        query = query.eq('customer_id', customerId)
      }

      const { data: order } = await query.maybeSingle()

      if (!order) return { error: 'Order not found. Cannot submit return request.' }

      const { error } = await supabase.from('refunds').insert({
        order_id: order.id,
        merchant_id: merchantId,
        reason: `Return Request: ${reason}`,
        status: 'pending'
      })

      if (error) return { error: 'Failed to submit return request.' }
      return { success: true, message: 'Your return request has been submitted. Our team will review it shortly.' }
    }
  } as any),

  /**
   * Escalate the conversation to a human support agent.
   */
  escalate_to_human: tool({
    description: 'Request a human agent to take over the conversation.',
    parameters: z.object({
      reason: z.string().describe('A brief explanation of why escalation is needed')
    }),
    execute: async ({ reason }: any) => {
      const { error: escError } = await supabase.from('support_escalations').insert({
        session_id: sessionId,
        merchant_id: ownerId,
        reason
      })

      if (escError) return { error: 'Failed to request human assistance.' }

      const { error: sessError } = await supabase
        .from('support_sessions')
        .update({ status: 'escalated' })
        .eq('id', sessionId)

      if (sessError) return { error: 'Failed to update session status.' }

      // NEW: Notify merchant via WhatsApp
      const { informMerchantViaWhatsApp } = await import('../utils/whatsapp-notifier')
      await informMerchantViaWhatsApp(
        ownerId,
        `🚨 *Support Escalation Alert*\n\nA customer is requesting human assistance.\n\n*Reason*: ${reason}\n*Session ID*: ${sessionId.slice(0, 8)}...\n\nPlease check your dashboard to take over.`,
        supabase
      )

      return { 
        success: true, 
        message: 'I have notified a human agent. They will get back to you as soon as possible. Feel free to leave more details here.' 
      }
    }
  } as any),

  /**
   * Collect customer contact information for session persistence and follow-up.
   */
  collect_customer_info: tool({
    description: 'Save the customer\'s name and email address for better support.',
    parameters: z.object({
      name: z.string().describe('The customer\'s name'),
      email: z.string().email().describe('The customer\'s email address')
    }),
    execute: async ({ name, email }: any) => {
      const { error } = await supabase
        .from('support_sessions')
        .update({ customer_name: name, customer_email: email })
        .eq('id', sessionId)

      if (error) return { error: 'Failed to save contact information.' }
      return { success: true, message: `Thank you, ${name}. I've updated your contact information.` }
    }
  } as any)
})
