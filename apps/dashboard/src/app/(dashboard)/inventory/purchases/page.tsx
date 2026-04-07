import { redirect } from 'next/navigation'

export default async function PurchasesPage() {
  redirect('/inventory/purchasing?tab=receipts')
}
