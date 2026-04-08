import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'
import { createClient } from '@supabase/supabase-js'
import { sendMarketingCampaign } from '@repo/email'

/**
 * Marketing Tools
 * 
 * Allows the agent to run marketing campaigns and promotional activities.
 */

export const sendMarketingCampaignTool = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Send a promotional email campaign to a segment of customers (VIPs, At-Risk, New, or All). Use this for newsletters, sales, or re-engagement.',
    parameters: z.object({
      segment: z.enum(['all', 'vips', 'at_risk', 'new']).describe('The target customer segment'),
      subject: z.string().min(1).describe('Email subject line. Use {{customer_name}} for personalization.'),
      body:    z.string().min(1).describe('The email content. Use HTML or plain text. Use {{customer_name}} for personalization.'),
    }),
    execute: (input: any) =>
      executeWithGuard(
        'send_marketing_campaign',
        input,
        {
          riskLevel: 'high',
          approvalTitle: (i) => `Send Marketing Campaign to ${i.segment.toUpperCase()} Customers`,
          approvalDescription: (i) => `Subject: ${i.subject}\n\n${i.body.substring(0, 200)}${i.body.length > 200 ? '...' : ''}`
        },
        merchantId,
        sessionId,
        async () => {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )

          // 1. Fetch merchant info for campaign
          const { data: merchant } = await supabase
            .from('merchants')
            .select('id, store_name, marketing_domain, marketing_from_name')
            .eq('id', merchantId)
            .single()

          if (!merchant) throw new Error('Merchant not found')

          // 2. Create campaign record
          const { data: campaign, error: campaignError } = await supabase
            .from('email_campaigns')
            .insert({
              merchant_id: merchantId,
              subject: input.subject,
              content: input.body,
              segment: input.segment,
              status: 'sending'
            })
            .select()
            .single()

          if (campaignError) throw new Error(`Failed to create campaign: ${campaignError.message}`)

          // 3. Fetch recipients based on segment
          let associatedIds: string[] = []

          if (input.segment === 'all') {
            const [{ data: loyaltyCusts }, { data: orderCusts }] = await Promise.all([
              supabase.from('loyalty_points').select('customer_id').eq('merchant_id', merchantId),
              supabase.from('orders').select('customer_id').eq('merchant_id', merchantId),
            ])
            associatedIds = Array.from(new Set([
              ...(loyaltyCusts?.map(l => l.customer_id) ?? []),
              ...(orderCusts?.map(o => o.customer_id) ?? []),
            ]))
          } else {
            // Detailed segmentation using RFM
            const { data: segments } = await supabase.rpc('get_customer_segments_rfm', { p_merchant_id: merchantId })
            
            if (segments) {
              associatedIds = segments
                .filter((s: any) => {
                  if (input.segment === 'vips') return ['Champion', 'Loyal'].includes(s.segment)
                  if (input.segment === 'at_risk') return ['At Risk', 'Cannot Lose Them'].includes(s.segment)
                  if (input.segment === 'new') return s.segment === 'New Customer'
                  return false
                })
                .map((s: any) => s.customer_id)
            }
          }

          if (associatedIds.length === 0) {
            await supabase.from('email_campaigns').update({ status: 'failed', error_message: 'No recipients found' }).eq('id', campaign.id)
            return { success: false, error: 'No customers found in this segment' }
          }

          const { data: profiles } = await supabase
            .from('profiles')
            .select('email, full_name')
            .in('id', associatedIds)
            .not('email', 'is', null)

          const recipients = profiles?.map(p => ({
            email: p.email as string,
            name: p.full_name || 'there'
          })).filter(r => r.email) || []

          if (recipients.length === 0) {
            await supabase.from('email_campaigns').update({ status: 'failed', error_message: 'No emails found' }).eq('id', campaign.id)
            return { success: false, error: 'No customer emails found' }
          }

          // 4. Trigger sending
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dashboard.hyperlocal.app'
          const unsubscribeBaseUrl = `${appUrl}/unsubscribe`

          const result = await sendMarketingCampaign(
            campaign.id,
            {
              id: merchant.id,
              marketing_domain: merchant.marketing_domain,
              marketing_from_name: merchant.marketing_from_name
            },
            recipients,
            input.subject,
            input.body,
            unsubscribeBaseUrl
          )

          return { 
            success: result.success, 
            campaign_id: campaign.id, 
            recipients_count: recipients.length,
            error: result.error 
          }
        }
      )
  } as any)
