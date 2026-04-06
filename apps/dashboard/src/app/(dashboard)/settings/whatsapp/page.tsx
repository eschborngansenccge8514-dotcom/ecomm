import { getAuthContext } from '@/lib/utils.server'
import { redirect } from 'next/navigation'
import { WhatsAppClient } from './WhatsAppClient'

export default async function WhatsAppSettingsPage() {
  const { merchant } = await getAuthContext()

  if (!merchant) {
    redirect('/settings')
  }

  return (
    <WhatsAppClient merchant={merchant} />
  )
}
