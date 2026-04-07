/**
 * Barcode utilities for format detection, validation, and generation.
 */

export type BarcodeFormat = 'EAN-13' | 'UPC-A' | 'EAN-8' | 'CODE128' | 'INTERNAL' | 'UNKNOWN';

/**
 * Detects the barcode format based on length and characters.
 */
export function detectBarcodeFormat(value: string): BarcodeFormat {
  const trimmed = value.trim();
  if (!trimmed) return 'UNKNOWN';

  if (/^\d{13}$/.test(trimmed)) return 'EAN-13';
  if (/^\d{12}$/.test(trimmed)) return 'UPC-A';
  if (/^\d{8}$/.test(trimmed)) return 'EAN-8';
  if (/^INT-\d{10,13}-[A-Z0-9]{4}$/.test(trimmed)) return 'INTERNAL';
  
  // CODE128 can be any ASCII, but usually alphanumeric for typical retail
  if (/^[A-Z0-9\-\.\ \$\/\+\%]+$/i.test(trimmed)) return 'CODE128';

  return 'UNKNOWN';
}

/**
 * Validates EAN-13 check digit (Modulo 10).
 */
export function validateEAN13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;

  const digits = value.split('').map(Number);
  const checkDigit = digits.pop();
  
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // Weight: 1 for odd positions, 3 for even positions (1-indexed)
    // In 0-indexing: weight 1 for even indices, weight 3 for odd indices
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }

  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  return checkDigit === calculatedCheckDigit;
}

/**
 * Generates a valid EAN-13 barcode using a GS1 internal-use prefix (200-299).
 * Use 200 as default Malaysian internal prefix.
 */
export function generateEAN13(prefix: string = '200'): string {
  // GS1 internal-use ranges: 200-299
  const base = prefix + Math.random().toString().slice(2, 11); // 3 (prefix) + 9 (random) = 12 digits
  const digits = base.split('').map(Number);
  
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return base + checkDigit;
}

/**
 * Fallback: Generate an internal structured barcode if EAN-13 is not preferred.
 */
export function generateInternalBarcode(): string {
  const timestamp = Date.now().toString().slice(-10);
  const random = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `INT-${timestamp}-${random}`;
}
