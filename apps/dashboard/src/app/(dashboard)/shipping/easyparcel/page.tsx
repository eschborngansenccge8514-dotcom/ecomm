import { getMerchant }    from '@/lib/utils.server'
import { EasyParcelClient } from '../../../../components/dashboard/EasyParcelClient'

export default async function EasyParcelPage() {
  const { supabase, merchant } = await getMerchant()

  const [{ data: settings }, { data: shipments }, { data: pendingOrders }] = await Promise.all([
    supabase.from('merchant_easyparcel_settings').select('*').eq('merchant_id', merchant.id).single(),
    supabase.from('easyparcel_shipments')
      .select('*, orders(order_number, buyer_name)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(100),
    // Orders that need shipping and don't have an EP shipment yet
    supabase.from('orders')
      .select('id, order_number, buyer_name, buyer_email, delivery_address, total_amount, created_at')
      .eq('merchant_id', merchant.id)
      .in('status', ['confirmed', 'paid', 'preparing'])
      .is('tracking_number', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Map database fields to what the client expects (buyer_name -> customer_name etc)
  const initialShipments = (shipments || []).map((s: any) => ({
    ...s,
    customer_name: s.orders?.buyer_name || s.send_name
  }))

  const initialPendingOrders = (pendingOrders || []).map((o: any) => ({
    ...o,
    customer_name: o.buyer_name,
    customer_email: o.buyer_email,
    shipping_address: o.delivery_address
  }))

  const hasGlobalKeys = !!(process.env.EASYPARCEL_API_KEY && process.env.EASYPARCEL_AUTH_KEY)

  if (process.env.NODE_ENV === 'development') {
    console.log('[EasyParcel] Global keys detected:', hasGlobalKeys)
    if (!hasGlobalKeys) {
      console.warn('[EasyParcel] Missing EASYPARCEL_API_KEY or EASYPARCEL_AUTH_KEY in dashboard environment.')
    }
  }

  // Merge profile into settings if missing sender details
  const effectiveSettings = {
    ...settings,
    sender_name:     settings?.sender_name     || merchant.store_name,
    sender_phone:    settings?.sender_phone    || merchant.phone?.replace(/\D/g, ''),
    sender_addr1:    settings?.sender_addr1    || merchant.address_line1,
    sender_city:     settings?.sender_city     || merchant.city,
    sender_state:    settings?.sender_state    || merchant.state,
    sender_postcode: settings?.sender_postcode || merchant.postcode,
    is_demo:         settings ? settings.is_demo : (process.env.NODE_ENV !== 'production')
  }

  return (
    <EasyParcelClient
      merchantId={merchant.id}
      merchant={merchant}
      initialSettings={effectiveSettings}
      initialShipments={initialShipments}
      pendingOrders={initialPendingOrders}
      hasGlobalKeys={hasGlobalKeys}
    />
  )
}
