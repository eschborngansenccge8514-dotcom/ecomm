/**
 * Standard encryption/decryption utilities for marketplace credentials.
 * Uses AES-GCM for strong encryption with an associated initialization vector.
 */

// Helper to convert base64 to Uint8Array
function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}

// Helper to convert Uint8Array to base64
function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join("");
  return btoa(binString);
}

/**
 * Encrypt a string using AES-GCM
 * @param text The plaintext to encrypt
 * @param keyBase64 The base64-encoded encryption key (must be 256 bits)
 * @returns A base64-encoded string containing IV + Ciphertext
 */
export async function encrypt(text: string, keyBase64: string): Promise<string> {
  const keyBytes = base64ToBytes(keyBase64);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encodedText
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return bytesToBase64(combined);
}

/**
 * Decrypt a base64-encoded string using AES-GCM
 * @param encryptedBase64 The base64-encoded IV + Ciphertext
 * @param keyBase64 The base64-encoded encryption key
 * @returns The decrypted plaintext
 */
export async function decrypt(encryptedBase64: string, keyBase64: string): Promise<string> {
  const keyBytes = base64ToBytes(keyBase64);
  const combined = base64ToBytes(encryptedBase64);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Convenience wrapper to encrypt JSON objects
 */
export async function encryptJson(obj: any, keyBase64: string): Promise<string> {
  return encrypt(JSON.stringify(obj), keyBase64);
}

/**
 * Convenience wrapper to decrypt JSON objects
 */
export async function decryptJson<T>(encryptedBase64: string, keyBase64: string): Promise<T> {
  const decrypted = await decrypt(encryptedBase64, keyBase64);
  return JSON.parse(decrypted) as T;
}
