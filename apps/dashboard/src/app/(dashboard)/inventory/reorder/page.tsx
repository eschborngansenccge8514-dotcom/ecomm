'use server'
import { getMerchant } from '@/lib/utils.server'
import { getReorderSuggestions } from '@/lib/inventory-actions'
import { ReorderSuggestionsClient } from '@/components/dashboard/inventory/ReorderSuggestionsClient'

export default async function ReorderPage() {
  const { merchant } = await getMerchant()
  const recommendations = await getReorderSuggestions()

  return (
    <ReorderSuggestionsClient recommendations={recommendations} />
  )
}
