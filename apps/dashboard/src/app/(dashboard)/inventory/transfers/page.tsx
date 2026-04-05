'use server'
import { getTransfers } from '@/lib/transfer-actions'
import { TransferListClient } from '@/components/dashboard/inventory/TransferListClient'

export default async function TransfersPage() {
  const transfers = await getTransfers()

  return (
    <TransferListClient transfers={transfers} />
  )
}
