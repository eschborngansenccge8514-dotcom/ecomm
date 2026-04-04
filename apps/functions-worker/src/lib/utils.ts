/** Fetch wrapper that automatically retries on transient 502/503/504 gateway errors */
export async function fetchWithRetry(
  url: string, 
  init: RequestInit, 
  maxAttempts = 3
): Promise<{ res: Response, attempts: number }> {
  const delays = [0, 1000, 2000]
  let lastRes: Response | null = null
  for (let i = 0; i < maxAttempts; i++) {
    if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]))
    
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 15000) // 15s timeout

    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(id)
      
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        lastRes = res
        console.warn(`[fetchWithRetry] Attempt ${i + 1} got HTTP ${res.status}, retrying...`)
        continue
      }
      return { res, attempts: i + 1 }
    } catch (err: any) {
      clearTimeout(id)
      if (err.name === 'AbortError') {
        console.error(`[fetchWithRetry] Attempt ${i + 1} timed out`)
      } else {
        console.error(`[fetchWithRetry] Attempt ${i + 1} failed:`, err.message)
      }
      if (i === maxAttempts - 1) throw err
      continue
    }
  }
  return { res: lastRes!, attempts: maxAttempts }
}

export async function logLalamoveApi(
  supabase: any,
  orderId: string,
  details: {
    endpoint: string,
    method: string,
    requestBody?: any,
    responseBody?: any,
    statusCode: number,
    attempt: number
  }
) {
  try {
    let sanitizedRequest = null
    if (details.requestBody) {
      if (typeof details.requestBody === 'string') {
        try {
          sanitizedRequest = JSON.parse(details.requestBody)
        } catch {
          sanitizedRequest = { raw: details.requestBody }
        }
      } else {
        sanitizedRequest = details.requestBody
      }
    }
    
    await supabase.from('lalamove_api_log').insert({
      order_id: orderId,
      endpoint: details.endpoint,
      method: details.method,
      request_body: sanitizedRequest,
      response_body: details.responseBody,
      status_code: details.statusCode,
      attempt: details.attempt
    })
  } catch (e) {
    console.error('Failed to log Lalamove API call:', e)
  }
}

export async function hmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const keyData = enc.encode(key)
  const msgData = enc.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hmacSha512(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const keyData = enc.encode(key)
  const msgData = enc.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
