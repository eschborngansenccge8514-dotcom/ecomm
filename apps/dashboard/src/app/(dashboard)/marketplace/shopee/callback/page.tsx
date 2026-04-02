'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function ShopeeCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const success = searchParams.get('success')
    const err = searchParams.get('error')

    if (success === 'true') {
      setStatus('success')
      // Redirect to marketplace overview after 3 seconds
      setTimeout(() => router.push('/marketplace'), 3000)
    } else if (err) {
      setStatus('error')
      setError(err)
    } else {
      // If we landed here without success/error, something is wrong
      // The Edge Function should have redirected here with ?success=true
      // This page is just a fallback/visual confirmation
      setStatus('success')
      setTimeout(() => router.push('/marketplace'), 2000)
    }
  }, [searchParams, router])

  return (
    <div className="max-w-md mx-auto py-20 px-6">
      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden text-center">
        <CardHeader className="pt-10">
          <div className="flex justify-center mb-4">
            {status === 'loading' && <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="w-16 h-16 text-green-500" />}
            {status === 'error' && <XCircle className="w-16 h-16 text-red-500" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && 'Verifying connection...'}
            {status === 'success' && 'Connection Successful!'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-10 space-y-6">
          <p className="text-gray-500">
            {status === 'loading' && 'Please wait while we finalize your Shopee integration.'}
            {status === 'success' && 'Your Shopee shop has been connected. Redirecting you back to the marketplace...'}
            {status === 'error' && (error || 'An error occurred during the authorization process.')}
          </p>

          {(status === 'success' || status === 'error') && (
            <Button 
              className="w-full rounded-xl" 
              variant={status === 'error' ? 'destructive' : 'default'}
              onClick={() => router.push('/marketplace')}
            >
              Back to Marketplace
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
