import { createClient } from './supabase/server'

/**
 * Server-side utility to call Supabase Edge Functions.
 * Refactored to move back from Cloudflare Worker.
 */
export async function invokeWorkerServer<T = any>(
  functionName: string,
  options?: { body?: any; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any }> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: options?.body,
      headers: options?.headers
    })

    if (error) {
      console.error(`[invokeFunctionServer] Error:`, error)
      return { data: null, error }
    }

    return { data: data as T, error: null }
  } catch (err: any) {
    console.error(`[invokeFunctionServer] Exception:`, err)
    return { data: null, error: err }
  }
}
