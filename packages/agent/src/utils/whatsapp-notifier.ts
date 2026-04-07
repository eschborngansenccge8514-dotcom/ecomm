import { createClient } from '@supabase/supabase-js'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://functions-worker.jjooi1707.workers.dev'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Inform the merchant of an issue via WhatsApp.
 * @param merchantId The UUID/Profile ID of the merchant.
 * @param message The text message to send.
 */
export async function informMerchantViaWhatsApp(merchantId: string, message: string) {
  try {
    // 1. Fetch merchant phone number from profiles
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', merchantId)
      .maybeSingle()

    if (error || !profile?.phone) {
       console.warn(`[whatsapp-notifier] Could not find phone for merchant ${merchantId}:`, error?.message || 'Phone missing')
       return
    }

    const number = profile.phone.startsWith('+') ? profile.phone : `+${profile.phone}`

    // 2. Send via WhatsApp worker
    const response = await fetch(`${WORKER_URL}/whatsapp/send-text`, {
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
