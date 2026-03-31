export async function buildLalamoveHeaders(
  apiKey:    string,
  apiSecret: string,
  method:    string,
  path:      string,
  body:      string = '',
  market:    string = 'MY'
): Promise<HeadersInit> {
  const timestamp = String(Date.now())
  const nonce     = crypto.randomUUID().replace(/-/g, '')

  // Lalamove v3 signature format
  const rawSignature = `${timestamp}\r\n${nonce}\r\n${method.toUpperCase()}\r\n${path}\r\n\r\n${body}`
  
  const encoder = new TextEncoder()
  const keyData = encoder.encode(apiSecret)
  const msgData = encoder.encode(rawSignature)
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    msgData
  )
  
  const signatureArray = Array.from(new Uint8Array(signatureBuffer))
  const signature      = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  const token = `${apiKey}:${timestamp}:${nonce}:${signature}`

  return {
    'Authorization': `hmac ${token}`,
    'Content-Type':  'application/json',
    'Market':        market,
    'Accept':        'application/json',
  }
}

export function getLalamoveBaseUrl(env?: string): string {
  const environment = env ?? Deno.env.get('DELIVERY_ENV') ?? 'sandbox'
  return environment === 'production'
    ? 'https://rest.lalamove.com'
    : 'https://rest.sandbox.lalamove.com'
}

