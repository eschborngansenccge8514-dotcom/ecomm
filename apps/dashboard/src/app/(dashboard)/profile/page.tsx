import { getAuthContext } from '@/lib/utils.server'
import { ProfileClient } from '@/components/dashboard/ProfileClient'

export default async function ProfilePage() {
  const { profile, user } = await getAuthContext()

  return (
    <ProfileClient 
      initialProfile={profile} 
      email={user.email || ''} 
    />
  )
}
