import { redirect } from 'next/navigation'

export default async function SuppliersPage() {
  redirect('/inventory/purchasing?tab=suppliers')
}
