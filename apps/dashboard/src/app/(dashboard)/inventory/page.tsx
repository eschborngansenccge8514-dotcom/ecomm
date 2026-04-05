'use server'
import { getInventoryDashboard } from '@/lib/inventory-actions'
import { InventoryDashboardClient } from '@/components/dashboard/inventory/InventoryDashboardClient'

export default async function InventoryDashboardPage() {
  const data = await getInventoryDashboard()

  return (
    <div className="p-6">
      <InventoryDashboardClient data={data} />
    </div>
  )
}
