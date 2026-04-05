'use client'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL

/**
 * Standardized utility to call the functions-worker (Cloudflare Worker).
 * Falls back to Supabase Edge Functions if NEXT_PUBLIC_WORKER_URL is not set.
 * Always returns the parsed response body in `data`, even on HTTP errors,
 * so callers can read the actual error message from `data.error`.
 */
export async function invokeWorker<T = any>(
  functionName: string,
  options?: { body?: any; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any }> {
  console.log(`[invokeFunction] Calling: ${functionName}`)

  try {
    if (WORKER_URL) {
      // Primary path: Call the Cloudflare Worker
      // e.g. "einvoice/submit" -> "https://worker.../einvoice/submit"
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
        console.error(`[invokeFunction] Worker error for ${functionName}:`, errMsg)
        return { data, error: new Error(errMsg) }
      }

      return { data, error: null }
    } else {
      // Fallback: call Supabase Edge Function directly
      // This requires the function name to match a deployed Supabase function slug
      const { createClient } = await import('./supabase/client')
      const supabase = createClient()

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: options?.body,
        headers: options?.headers
      })

      if (error) {
        console.error(`[invokeFunction] Supabase error calling ${functionName}:`, error)
        let responseData: T | null = data as T | null
        if (!responseData && (error as any)?.context) {
          try {
            responseData = await (error as any).context.json()
          } catch {
            // context body not parseable
          }
        }
        return { data: responseData, error }
      }

      return { data: data as T, error: null }
    }
  } catch (err: any) {
    console.error(`[invokeFunction] Exception calling ${functionName}:`, err)
    return { data: null, error: err }
  }
}
