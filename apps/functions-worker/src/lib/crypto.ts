/**
 * AES-256-GCM encryption/decryption for Cloudflare Workers (SubtleCrypto).
 * Compatible with existing [IV (12b) | Tag (16b) | Ciphertext] format.
 */

export async function encryptJson(payload: any, keyBase64: string): Promise<string> {
  const enc = new TextEncoder()
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = enc.encode(JSON.stringify(payload))

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  )

  // IV (12) + Tag (16) + Ciphertext
  // SubtleCrypto.encrypt returns [ciphertext | tag] (tag is 16 bytes at the end)
  const result = new Uint8Array(iv.length + encrypted.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(encrypted), iv.length)

  return btoa(String.fromCharCode(...result))
}

export async function decryptJson<T>(encryptedBase64: string, keyBase64: string): Promise<T> {
  const dec = new TextDecoder()
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))
  const raw = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))

  const iv = raw.slice(0, 12)
  const encrypted = raw.slice(12)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  )

  return JSON.parse(dec.decode(decrypted)) as T
}
