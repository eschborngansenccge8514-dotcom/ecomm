'use server'
import { SupplierFormClient } from '@/components/dashboard/inventory/SupplierFormClient'

export default async function NewSupplierPage() {
  return (
    <div className="p-6">
      <SupplierFormClient />
    </div>
  )
}
