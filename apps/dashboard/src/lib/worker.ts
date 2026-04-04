'use client'
import { createClient } from './supabase/client'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://functions-worker.jjooi1707.workers.dev'

/**
 * Standardized utility to call the unified Cloudflare Worker.
 * Maps legacy Supabase function names to worker routes.
 */
export async function invokeWorker<T = any>(
  functionName: string,
  options?: { body?: any; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any }> {
  // 1. Map functionName (e.g. 'lalamove-quote') to route (e.g. '/lalamove/quote')
  // We handle special cases manually if needed
  let path = functionName.replace(/-/g, '/')
  
  // Custom mappings for special cases
  if (functionName === 'award-loyalty-points') path = 'internal/loyalty/award'
  if (functionName === 'send-push-notification') path = 'internal/push'
  if (functionName === 'billplz-refund') path = 'billplz/refund'
  if (functionName === 'razorpay-refund') path = 'webhooks/razorpay-refund' // or wherever we put it
  
  const url = `${WORKER_URL}/${path}`

  // 2. Get Auth Session for JWT
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
        ...options?.headers
      },
      body: options?.body ? JSON.stringify(options.body) : undefined
    })

    const contentType = res.headers.get('content-type')
    let data: T | null = null

    if (contentType?.includes('application/json')) {
      data = await res.json()
    } else {
      const text = await res.text()
      data = { message: text } as any
    }

    if (!res.ok) {
      return { data: null, error: data || { message: res.statusText } }
    }

    return { data, error: null }
  } catch (err: any) {
    console.error(`[invokeWorker] Error calling ${functionName}:`, err)
    return { data: null, error: err }
  }
}
