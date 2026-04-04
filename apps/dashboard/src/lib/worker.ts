'use client'
import { createClient } from './supabase/client'

/**
 * Standardized utility to call Supabase Edge Functions.
 * Always returns the parsed response body in `data`, even on HTTP errors,
 * so callers can read the actual error message from `data.error`.
 */
export async function invokeWorker<T = any>(
  functionName: string,
  options?: { body?: any; headers?: Record<string, string> }
): Promise<{ data: T | null; error: any }> {
  const supabase = createClient()

  console.log(`[invokeFunction] Calling: ${functionName}`)

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: options?.body,
      headers: options?.headers
    })

    if (error) {
      console.error(`[invokeFunction] Error calling ${functionName}:`, error)
      // Try to extract the actual response body from the HTTP error context
      // so callers can read data.error instead of the generic FunctionsHttpError message
      let responseData: T | null = data as T | null
      if (!responseData && error?.context) {
        try {
          responseData = await error.context.json()
        } catch {
          // context body not parseable — leave responseData as null
        }
      }
      return { data: responseData, error }
    }

    return { data: data as T, error: null }
  } catch (err: any) {
    console.error(`[invokeFunction] Exception calling ${functionName}:`, err)
    return { data: null, error: err }
  }
}
