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
    // 1. Fetch merchant phone number from profiles
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', merchantId)
      .single()

    if (error || !profile?.phone) {
       console.warn(`[whatsapp-notifier] Could not find phone for merchant ${merchantId}:`, error?.message || 'Phone missing')
       return
    }

    const number = profile.phone.startsWith('+') ? profile.phone : `+${profile.phone}`

    // 2. Send via WhatsApp worker
    const response = await fetch(`${workerUrl}/whatsapp/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number,
        text: message,
        merchant_id: merchantId
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
