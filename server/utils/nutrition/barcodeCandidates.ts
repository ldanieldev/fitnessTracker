import { toGtin13 } from '~~/shared/utils/gtin'

// A scanned code may be a 12-digit UPC-A, its zero-padded GTIN-13, or the un-padded UPC-A of a stored GTIN-13 — try all three.
export function barcodeCandidates(code: string): string[] {
  const gtin13 = toGtin13(code)
  const upcA = gtin13.length === 13 && gtin13.startsWith('0') ? gtin13.slice(1) : null
  return [...new Set([code, gtin13, upcA].filter((candidate): candidate is string => candidate !== null))]
}
