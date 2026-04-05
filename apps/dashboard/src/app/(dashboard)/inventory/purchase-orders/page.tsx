'use server'
import { getPurchaseOrders } from '@/lib/purchase-order-actions'
import { PurchaseOrderListClient } from '@/components/dashboard/inventory/PurchaseOrderListClient'

export default async function PurchaseOrdersPage() {
  const purchaseOrders = await getPurchaseOrders()

  return (
    <PurchaseOrderListClient initialOrders={purchaseOrders} />
  )
}
