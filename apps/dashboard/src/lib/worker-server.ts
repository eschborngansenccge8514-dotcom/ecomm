import { createClient } from './supabase/server'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL

/**
 * Server-side utility to call the functions-worker (Cloudflare Worker)
 * or fall back to Supabase Edge Functions.
 */
export async function invokeWorkerServer<T = any>(
  functionName: string,
  options?: { body?: any; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any }> {
  try {
    if (WORKER_URL) {
      const url = `${WORKER_URL}/${functionName}`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        },
        body: options?.body ? JSON.stringify(options.body) : undefined
      })

      let data: T | null = null
      try {
        data = await res.json() as T
      } catch {
        // Body not parseable
      }

      if (!res.ok) {
        const errMsg = (data as any)?.error || (data as any)?.message || `HTTP ${res.status}`
        console.error(`[invokeWorkerServer] Worker error for ${functionName}:`, errMsg)
        return { data, error: new Error(errMsg) }
      }

      return { data, error: null }
    } else {
      const supabase = await createClient()
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: options?.body,
        headers: options?.headers
      })

      if (error) {
        console.error(`[invokeWorkerServer] Supabase error for ${functionName}:`, error)
        return { data: data as T, error }
      }

      return { data: data as T, error: null }
    }
  } catch (err: any) {
    console.error(`[invokeWorkerServer] Exception calling ${functionName}:`, err)
    return { data: null, error: err }
  }
}
