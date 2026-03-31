import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";

/**
 * Encrypts a JSON-serializable object using AES-256-GCM.
 * @param payload The object to encrypt.
 * @param keyBase64 The 32-byte Base64 encoded encryption key.
 * @returns A Base64 encoded string containing [iv, tag, ciphertext].
 */
export function encryptJson(payload: unknown, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);

  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine IV + Auth Tag + Ciphertext into one Buffer
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decrypts a Base64 encoded string back to a typed object.
 * @param encrypted The Base64 encoded string [iv, tag, ciphertext].
 * @param keyBase64 The 32-byte Base64 encoded encryption key.
 * @returns The decrypted object.
 */
export function decryptJson<T>(encrypted: string, keyBase64: string): T {
  const key = Buffer.from(keyBase64, "base64");
  const raw = Buffer.from(encrypted, "base64");
  
  // Extract parts
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
