import { getSuppliers } from '@/lib/supplier-actions'
import { 
  getPurchaseOrders, 
  getGoodsReceipts,
  getPurchasePayments
} from '@/lib/purchase-order-actions'
import { PurchasingPageClient } from '@/components/dashboard/inventory/PurchasingPageClient'

export default async function PurchasingPage() {
  const [suppliers, purchaseOrders, goodsReceipts, payments] = await Promise.all([
    getSuppliers(),
    getPurchaseOrders(),
    getGoodsReceipts(),
    getPurchasePayments()
  ])

  return (
    <PurchasingPageClient 
      suppliers={suppliers}
      purchaseOrders={purchaseOrders}
      goodsReceipts={goodsReceipts}
      payments={payments}
    />
  )
}
