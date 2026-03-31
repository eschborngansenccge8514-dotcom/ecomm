import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const getSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

export type MarketplaceProvider = 'shopee' | 'tiktok' | 'lazada' | 'google_merchant'

export interface NormalizedEvent {
  providerId: MarketplaceProvider
  externalEventId: string
  tenantId?: string
  accountId?: string
  eventType: string
  payload: any
}

export const recordMarketplaceEvent = async (supabase: any, event: NormalizedEvent) => {
  const { data, error } = await supabase
    .from('marketplace_events')
    .insert({
      provider_id: event.providerId,
      external_event_id: event.externalEventId,
      tenant_id: event.tenantId,
      account_id: event.accountId,
      event_type: event.eventType,
      payload: event.payload,
      status: 'pending'
    })
    .select()
    .single()

  return { data, error }
}
