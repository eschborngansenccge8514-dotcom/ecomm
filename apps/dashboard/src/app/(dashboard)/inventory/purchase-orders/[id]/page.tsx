'use server'
import { getPurchaseOrder } from '@/lib/purchase-order-actions'
import { PurchaseOrderDetailClient } from '@/components/dashboard/inventory/PurchaseOrderDetailClient'

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const po = await getPurchaseOrder(id)

  return (
    <div className="p-6">
      <PurchaseOrderDetailClient po={po} />
    </div>
  )
}
