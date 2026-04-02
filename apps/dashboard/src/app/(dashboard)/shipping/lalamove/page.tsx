
import { getMerchant } from '@/lib/utils.server'
import { LalamoveClient } from '@/components/dashboard/LalamoveClient'

export default async function LalamovePage() {
  const { supabase, merchant } = await getMerchant()

  // 1. Fetch Lalamove config
  const { data: config } = await supabase
    .from('merchant_lalamove_config')
    .select('*')
    .eq('merchant_id', merchant.id)
    .maybeSingle()

  // 2. Fetch Lalamove orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('merchant_id', merchant.id)
    .eq('delivery_provider', 'lalamove')
    .order('created_at', { ascending: false })

  // 3. Fetch Lalamove API logs
  const { data: logs } = await supabase
    .from('lalamove_api_log')
    .select('*')
    .in('order_id', (orders || []).map(o => o.id))
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <LalamoveClient 
      merchantId={merchant.id} 
      merchant={merchant}
      initialConfig={config} 
      initialOrders={orders || []} 
      initialLogs={logs || []}
    />
  )
}
