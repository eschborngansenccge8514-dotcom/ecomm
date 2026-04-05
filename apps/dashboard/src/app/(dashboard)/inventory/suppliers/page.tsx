'use server'
import { getSuppliers } from '@/lib/supplier-actions'
import { SupplierListClient } from '@/components/dashboard/inventory/SupplierListClient'

export default async function SuppliersPage() {
  const suppliers = await getSuppliers()

  return (
    <SupplierListClient suppliers={suppliers} />
  )
}
