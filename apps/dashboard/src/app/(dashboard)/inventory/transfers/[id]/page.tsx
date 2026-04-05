'use server'
import { getTransfer } from '@/lib/transfer-actions'
import { TransferDetailClient } from '@/components/dashboard/inventory/TransferDetailClient'

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const transfer = await getTransfer(id)

  return (
    <div className="p-6">
      <TransferDetailClient transfer={transfer} />
    </div>
  )
}
