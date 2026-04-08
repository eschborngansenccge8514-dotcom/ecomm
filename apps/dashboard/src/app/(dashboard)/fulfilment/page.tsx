import { getMerchant } from '@/lib/utils.server'
import { FulfilmentClient } from '@/components/dashboard/FulfilmentClient'

export default async function FulfilmentPage() {
  const { supabase, merchant } = await getMerchant()

  const { data: fulfilments, error } = await supabase
    .from('fulfilments')
    .select(`
      *,
      order:orders(order_number, buyer_name),
      fulfilment_items(*, product:products(name, sku), variant:product_variants(name, sku))
    `)
    .eq('merchant_id', merchant.id)
    .in('status', ['pending', 'picking', 'picked', 'packing', 'packed'])
    .order('created_at', { ascending: false })

  if (error) console.error('Fulfilment query error:', error.message)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Fulfilment</h1>
        <p className="text-sm text-gray-400 mt-1">Pick, pack and dispatch your orders.</p>
      </div>
      <FulfilmentClient initialFulfilments={fulfilments ?? []} />
    </div>
  )
}
