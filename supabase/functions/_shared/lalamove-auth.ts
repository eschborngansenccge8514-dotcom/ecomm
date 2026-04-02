export async function buildLalamoveHeaders(
  apiKey:    string,
  apiSecret: string,
  method:    string,
  path:      string,
  body:      string = '',
  market:    string = 'MY'
): Promise<HeadersInit> {
  const timestamp = String(Date.now())

  // Lalamove v3 signature format (no nonce):
  // {timestamp}\r\n{METHOD}\r\n{path}\r\n\r\n{body}
  const rawSignature = `${timestamp}\r\n${method.toUpperCase()}\r\n${path}\r\n\r\n${body}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawSignature))
  const signature = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')

  // Token format: hmac {apiKey}:{timestamp}:{signature}
  return {
    'Authorization': `hmac ${apiKey}:${timestamp}:${signature}`,
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
