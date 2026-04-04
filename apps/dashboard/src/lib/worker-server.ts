import { createClient } from './supabase/server'

const WORKER_URL = 'https://functions-worker.jjooi1707.workers.dev'

/**
 * Server-side utility to call the unified Cloudflare Worker.
 * Uses the service role or user session from the server context.
 */
export async function invokeWorkerServer<T = any>(
  functionName: string,
  options?: { body?: any; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any }> {
  let path = functionName.replace(/-/g, '/')
  
  // Custom mappings
  if (functionName === 'award-loyalty-points') path = 'internal/loyalty/award'
  if (functionName === 'send-push-notification') path = 'internal/push'
  
  const url = `${WORKER_URL}/${path}`

  const supabase = await createClient()
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
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text } as any
      }
    }

    if (!res.ok) {
      return { data: null, error: data || { message: res.statusText } }
    }

    return { data, error: null }
  } catch (err: any) {
    console.error(`[invokeWorkerServer] Error:`, err)
    return { data: null, error: err }
  }
}
