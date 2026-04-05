'use server'
import { getSuppliers } from '@/lib/supplier-actions'
import { PurchaseOrderFormClient } from '@/components/dashboard/inventory/PurchaseOrderFormClient'

export default async function NewPurchaseOrderPage() {
  const suppliers = await getSuppliers()

  return (
    <div className="p-6">
      <PurchaseOrderFormClient suppliers={suppliers} />
    </div>
  )
}
