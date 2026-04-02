import { getMerchant }    from '@/lib/utils.server'
import { DeliveryClient } from '@/components/dashboard/DeliveryClient'

export default async function DeliveryPage() {
  const { supabase, merchant } = await getMerchant()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, status, delivery_type, delivery_provider, tracking_number, tracking_url, delivery_address, created_at, delivery_fee, driver_name, driver_phone, driver_plate, lalamove_order_id, easyparcel_order_no, exception_flag, exception_reason, exception_details, priority_fee_added, delivery_status, delivery_quote_id, delivery_service_id')
    .eq('merchant_id', merchant.id)
    .in('status', ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'cancelled'])
    .order('created_at', { ascending: false })

  return <DeliveryClient orders={orders ?? []} merchantId={merchant.id} />
}
