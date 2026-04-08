import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Inform the merchant of an issue via WhatsApp.
 * @param merchantId The profile ID (owner_id) of the merchant.
 * @param message The text message to send.
 * @param supabase Injected Supabase client
 * @param workerUrl The URL of the functions worker (for calling WhatsApp endpoint)
 */
export async function informMerchantViaWhatsApp(
  merchantId: string | null, 
  message: string,
  supabase: SupabaseClient,
  workerUrl: string = 'https://functions-worker.jjooi1707.workers.dev'
) {
  try {
    // 1. Fetch merchant phone number. 
    // We try multiple sources:
    // a) Profile directly (merchantId might be a profile ID)
    // b) Merchant directly (merchantId might be a merchant ID)
    // c) Merchant's owner profile (if merchantId is a merchant ID)

    let phone: string | null = null

    // Try Profile directly
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', merchantId as string)
      .maybeSingle()
    
    phone = profile?.phone || null

    let instanceName: string | null = null

    // If not found, try Merchant table
    if (!phone) {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('phone, owner_id, whatsapp_instance_name')
        .eq('id', merchantId as string)
        .maybeSingle()

      phone = merchant?.phone || null
      instanceName = merchant?.whatsapp_instance_name || null

      // If merchant found but no phone, try its owner's profile
      if (!phone && merchant?.owner_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', merchant.owner_id)
          .maybeSingle()
        phone = ownerProfile?.phone || null
      }
    }

    // If we only had a profile ID, look up the merchant for instance name
    if (!instanceName) {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('whatsapp_instance_name')
        .eq('owner_id', merchantId as string)
        .maybeSingle()
      instanceName = merchant?.whatsapp_instance_name || null
    }

    if (!phone) {
       console.warn(`[whatsapp-notifier] Could not find phone for merchant ${merchantId}: Phone missing in profiles and merchants`)
       return
    }

    const number = phone.startsWith('+') ? phone : `+${phone}`

    // 2. Send via WhatsApp worker
    const response = await fetch(`${workerUrl}/whatsapp/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number,
        text: message,
        merchant_id: merchantId,
        ...(instanceName && { instance: instanceName })
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`[whatsapp-notifier] Failed to send WhatsApp to ${number}:`, errorText)
    } else {
      console.log(`[whatsapp-notifier] Notification sent to ${number}`)
    }
  } catch (err) {
    console.error(`[whatsapp-notifier] Exception:`, err)
  }
}
