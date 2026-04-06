import { getAuthContext } from '@/lib/utils.server'
import { EmailSettingsClient } from './EmailSettingsClient'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Email Settings' }

export default async function EmailSettingsPage() {
  const { merchant, profile } = await getAuthContext()

  if (!merchant) {
    redirect('/operations')
  }

  // Admins manage global settings elsewhere
  if (profile?.role === 'admin') {
    redirect('/admin')
  }

  return (
    <div className="p-6">
      <EmailSettingsClient merchant={merchant} />
    </div>
  )
}
