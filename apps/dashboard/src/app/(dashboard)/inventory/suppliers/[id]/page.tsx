'use server'
import { getSupplier, getProductSuppliers } from '@/lib/supplier-actions'
import { SupplierFormClient } from '@/components/dashboard/inventory/SupplierFormClient'

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supplier = await getSupplier(id)

  return (
    <div className="p-6">
      <SupplierFormClient initialData={supplier} />
    </div>
  )
}
