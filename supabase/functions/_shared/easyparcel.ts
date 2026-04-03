import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STATE_CODES: Record<string, string> = {
  'johor': 'jhr', 'kedah': 'kdh', 'kelantan': 'ktn', 'melaka': 'mlk',
  'negeri sembilan': 'nsn', 'pahang': 'phg', 'perak': 'prk', 'perlis': 'pls',
  'pulau pinang': 'png', 'penang': 'png',
  'sabah': 'sbh', 'sarawak': 'swk', 'selangor': 'sgr', 'terengganu': 'trg',
  'w.p. kuala lumpur': 'kul', 'kuala lumpur': 'kul', 'kl': 'kul',
  'w.p. labuan': 'lbn', 'labuan': 'lbn',
  'w.p. putrajaya': 'pjy', 'putrajaya': 'pjy',
}

export function getStateCode(state: string): string {
  if (!state) return ''
  const clean = state.toLowerCase().trim()
  return STATE_CODES[clean] ?? clean.replace(/\s+/g, '').slice(0, 3)
}

/**
 * PHP http_build_query–compatible serialiser (handles nested arrays)
 */
export function serializeEasyParcelParams(obj: any, prefix = ''): string {
  const parts: string[] = []
  const enc = (v: any) => encodeURIComponent(String(v ?? ''))

  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      const k = `${prefix}[${i}]`
      parts.push(typeof v === 'object' && v !== null ? serializeEasyParcelParams(v, k) : `${enc(k)}=${enc(v)}`)
    })
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, v] of Object.entries(obj)) {
      const k = prefix ? `${prefix}[${key}]` : key
      parts.push(typeof v === 'object' && v !== null ? serializeEasyParcelParams(v, k) : `${enc(k)}=${enc(v)}`)
    }
  }
  return parts.join('&')
}

/**
 * Returns the collection date based on 12 PM cutoff.
 */
export function getCollectionDate(): string {
  const now = new Date()
  // Adjust for Malaysia Time (UTC+8)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
  const klTime = new Date(utc + (3600000 * 8))
  
  if (klTime.getHours() >= 12) {
    klTime.setDate(klTime.getDate() + 1)
  }
  
  // Basic working day check (skip Sunday)
  if (klTime.getDay() === 0) { // Sunday
    klTime.setDate(klTime.getDate() + 1)
  }
  
  return klTime.toISOString().slice(0, 10)
}

export async function logEasyParcelApi(
  supabase: any,
  orderId: string | null,
  details: {
    action: string,
    params: any,
    response: any,
    error?: string,
    attempt: number
  }
) {
  try {
    await supabase.from('easyparcel_api_log').insert({
      order_id: orderId,
      action: details.action,
      request_payload: details.params,
      response_payload: details.response,
      error_message: details.error,
      attempt: details.attempt
    })
  } catch (e) {
    console.error('Failed to log EasyParcel API call:', e)
  }
}

export async function callEasyParcel(
  supabase: any,
  orderId: string | null,
  action: string,
  params: Record<string, any>,
  config?: { apiKey?: string; authKey?: string; environment?: string }
) {
  const authKey = config?.authKey || Deno.env.get('EASYPARCEL_AUTH_KEY')!
  const apiKey = config?.apiKey || Deno.env.get('EASYPARCEL_API_KEY')!
  const baseUrl = config?.environment === 'sandbox' 
    ? `https://demo.connect.easyparcel.my/?ac=${action}`
    : `https://connect.easyparcel.my/?ac=${action}`
  
  const MAX_RETRIES = 3
  let attempt = 1
  let lastError = ''

  while (attempt <= MAX_RETRIES) {
    try {
      // Marketplace API requires authentication key + api key for ALL actions in connect version
      const payload: any = { 
        api: apiKey, 
        authentication: authKey,
        ...params 
      }

      const body = serializeEasyParcelParams(payload)
      
      console.log(`[easyparcel-api] Calling ${action} at ${baseUrl}`)
      console.log(`[easyparcel-api] Payload keys: ${Object.keys(payload).join(', ')}`)

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      })

      const text = await response.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error(`[easyparcel-api] Failed to parse JSON: ${text.slice(0, 500)}`)
        throw new Error(`EasyParcel returned invalid JSON: ${text.slice(0, 200)}`)
      }

      console.log(`[easyparcel-api] ${action} status: ${data.api_status}`)
      if (data.api_status !== 'Success') {
        console.error(`[easyparcel-api] ${action} full response:`, text)
      }

      // ─── 3. Log to database ────────────────────────────────────────────────
      await logEasyParcelApi(supabase, orderId, {
        action,
        params,
        response: data,
        attempt
      })

      // EasyParcel-level error (invalid key, validation fail)
      if (data.api_status === 'Error' || data.api_status === 'Fail') {
        if (data.error_code === 3) throw new Error("Invalid API Key")
        throw new Error(data.error_remark || data.error_message || 'EasyParcel API Error')
      }

      return data

    } catch (err: any) {
      lastError = err.message
      if (attempt >= MAX_RETRIES) {
        // Final failure log if not already logged (catch block)
        await logEasyParcelApi(supabase, orderId, {
          action,
          params,
          response: null,
          error: lastError,
          attempt
        })
        throw err
      }
      
      const waitTime = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
      console.warn(`EasyParcel ${action} attempt ${attempt} failed: ${lastError}. Retrying in ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      attempt++
    }
  }
}

/**
 * Extracts the cheapest available courier from a Marketplace Rate Checking response.
 * Returns null if no rates are found.
 */
export function getCheapestCourierFromRates(rateData: any): any {
  const rates = rateData?.result?.[0]?.rates || [];
  if (rates.length === 0) return null;
  
  // Sort by price ascending and take the first one
  return [...rates].sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price))[0];
}
