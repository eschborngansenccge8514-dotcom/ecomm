import { createClient } from '@/lib/supabase/server'
import { CheckCircle2, MailX } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  if (!email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-sm text-gray-500 font-medium">Invalid unsubscribe link.</p>
      </div>
    )
  }

  const supabase = await createClient()

  // Update profile to opt-out
  const { error } = await supabase
    .from('profiles')
    .update({ marketing_opt_out: true })
    .eq('email', email)

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-red-100 shadow-xl rounded-3xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <MailX size={24} />
            </div>
            <CardTitle className="text-xl font-black uppercase">Something went wrong</CardTitle>
            <CardDescription>We couldn't process your request. Please try again later.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-gray-100 shadow-xl rounded-3xl overflow-hidden">
        <div className="h-2 bg-blue-600" />
        <CardHeader className="text-center pt-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-inner animate-in zoom-in-50 duration-500">
            <CheckCircle2 size={32} />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight uppercase">Unsubscribed</CardTitle>
          <CardDescription className="text-sm font-medium mt-2">
            You have been successfully removed from our marketing list.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-12 px-8">
          <p className="text-xs text-gray-400 leading-relaxed italic">
            You will no longer receive marketing emails from this store. 
            Transactional emails (like order confirmations) will still be sent normally.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
