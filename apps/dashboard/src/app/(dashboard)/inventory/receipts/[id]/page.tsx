import React from 'react'
import { getGoodsReceipt } from '@/lib/purchase-order-actions'
import { GoodsReceiptDetailClient } from '@/components/dashboard/inventory/GoodsReceiptDetailClient'
import { notFound } from 'next/navigation'

export default async function GoodsReceiptPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const receipt = await getGoodsReceipt(id)

  if (!receipt) notFound()

  return (
    <GoodsReceiptDetailClient receipt={receipt} />
  )
}
