import React from 'react'
import { getPurchaseOrder } from '@/lib/purchase-order-actions'
import { getSuppliers } from '@/lib/inventory-actions'
import { PurchaseOrderEditClient } from '@/components/dashboard/inventory/PurchaseOrderEditClient'
import { notFound, redirect } from 'next/navigation'

export default async function PurchaseOrderEditPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const [po, suppliers] = await Promise.all([
    getPurchaseOrder(id),
    getSuppliers()
  ])

  if (!po) notFound()
  if (po.status !== 'draft') {
    // Only draft POs can be edited, redirect to view
    redirect(`/inventory/purchase-orders/${id}`)
  }

  return (
    <PurchaseOrderEditClient 
      suppliers={suppliers} 
      po={po} 
    />
  )
}
