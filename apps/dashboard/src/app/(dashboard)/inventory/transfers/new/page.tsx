'use server'
import { getOutlets } from '@/lib/inventory-actions'
import { TransferFormClient } from '@/components/dashboard/inventory/TransferFormClient'

export default async function NewTransferPage() {
  const outlets = await getOutlets()

  return (
    <div className="p-6">
      <TransferFormClient outlets={outlets} />
    </div>
  )
}
