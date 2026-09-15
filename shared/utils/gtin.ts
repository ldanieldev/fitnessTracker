// USDA reports UPC-A as 12 digits, OFF/GS1 report the zero-padded GTIN-13; normalise so both resolve to the same barcode.
export function toGtin13(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 12 ? `0${digits}` : digits
}
