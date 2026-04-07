'use server'

import { createClient } from '@/lib/supabase/server'
import { getMerchant } from '@/lib/utils.server'
import { sendMarketingCampaign } from '@repo/email'
import { revalidatePath } from 'next/cache'

export async function createAndSendCampaign(formData: {
  subject: string;
  content: string;
  segment: string;
  scheduledAt?: string;
}) {
  const { supabase, merchant } = await getMerchant()
  
  if (!merchant) throw new Error('Not authenticated')

  // 1. Create campaign record
  const { data: campaign, error: createError } = await supabase
    .from('email_campaigns')
    .insert({
      merchant_id: merchant.id,
      subject: formData.subject,
      content: formData.content,
      segment: formData.segment,
      status: formData.scheduledAt ? 'draft' : 'sending',
      scheduled_for: formData.scheduledAt || null,
    })
    .select()
    .single()

  if (createError) throw new Error(createError.message)

  // 2. Fetch recipients based on segment
  let associatedIds: string[] = []

  if (formData.segment === 'all') {
    const [ { data: loyaltyCusts }, { data: orderCusts } ] = await Promise.all([
      supabase.from('loyalty_points').select('customer_id').eq('merchant_id', merchant.id),
      supabase.from('orders').select('customer_id').eq('merchant_id', merchant.id),
    ])
    associatedIds = Array.from(new Set([
      ...(loyaltyCusts?.map(l => l.customer_id) ?? []),
      ...(orderCusts?.map(o => o.customer_id)   ?? []),
    ]))
  } else {
    // Detailed segmentation using RFM
    const { data: segments } = await supabase.rpc('get_customer_segments_rfm', { p_merchant_id: merchant.id })
    
    if (segments) {
      associatedIds = segments
        .filter((s: any) => {
          if (formData.segment === 'vips') return ['Champion', 'Loyal'].includes(s.segment)
          if (formData.segment === 'at_risk') return ['At Risk', 'Cannot Lose Them'].includes(s.segment)
          if (formData.segment === 'new') return s.segment === 'New Customer'
          return false
        })
        .map((s: any) => s.customer_id)
    }
  }

  if (associatedIds.length === 0) {
    await supabase.from('email_campaigns').update({ status: 'failed', error_message: 'No recipients found for this segment' }).eq('id', campaign.id)
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

  // Identifies the base URL for the unsubscribe link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dashboard.hyperlocal.app'
  const unsubscribeBaseUrl = `${appUrl}/unsubscribe`

  // 3. Trigger sending 
  // If scheduled, we just leave it in draft for now, but Resend supports scheduling. Let's pass it.
  const result = await sendMarketingCampaign(
    campaign.id,
    {
      id: merchant.id,
      marketing_domain: merchant.marketing_domain,
      marketing_from_name: merchant.marketing_from_name
    },
    recipients,
    formData.subject,
    formData.content,
    unsubscribeBaseUrl,
    formData.scheduledAt || null
  )

  revalidatePath('/marketing')
  return result
}
