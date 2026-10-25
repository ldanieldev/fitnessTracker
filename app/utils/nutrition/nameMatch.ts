function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function namesDiffer(a: string, b: string): boolean {
  const left = normalize(a)
  const right = normalize(b)
  return left !== '' && right !== '' && left !== right
}

export function barcodeHint(current: string, barcode: string | null): string | null {
  return barcode && namesDiffer(current, barcode) ? barcode : null
}
