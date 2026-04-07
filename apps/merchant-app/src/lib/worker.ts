import { supabase } from './supabase'

export const WORKER_URL = process.env.EXPO_PUBLIC_WORKER_URL || 'https://functions-worker.jjooi1707.workers.dev'

/**
 * Standardized utility to call the unified Cloudflare Worker from Mobile.
 * Maps legacy Supabase function names to worker routes.
 */
export async function invokeWorker<T = any>(
  functionName: string,
  options?: { body?: any; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any }> {
  // 1. Determine the path
  let path = ''
  
  // Custom mappings for mobile-specific variants take highest precedence
  if (functionName === 'get-delivery-quotes') {
    path = 'logistics/get-delivery-quotes'
  } else if (functionName.includes('/')) {
    // If it already looks like a path (has slashes), use it as is
    path = functionName
  } else {
    // Legacy Supabase function name (no slashes) -> convert hyphens to slashes
    path = functionName.replace(/-/g, '/')
  }
  
  // Additional internal mappings for known legacy names
  if (functionName === 'easyparcel-rate-check') path = 'easyparcel/rates'
  if (functionName === 'geocode-address') path = 'internal/geocode'
  if (functionName === 'award-loyalty-points') path = 'internal/loyalty/award'
  if (functionName === 'redeem-loyalty-points') path = 'internal/loyalty/redeem'
  
  const url = `${WORKER_URL}/${path}`
  console.log(`[invokeWorker] Calling: ${url}`)

  // 2. Get JWT Session
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
    console.error(`[invokeWorker] Mobile Error calling ${functionName}:`, err)
    return { data: null, error: err }
  }
}
