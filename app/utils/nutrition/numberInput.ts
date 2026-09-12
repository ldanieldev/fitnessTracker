export function parseAmount(raw: string): number | null {
  const text = raw.trim().replace(',', '.')
  if (!/^\d*\.?\d*$/.test(text) || text === '' || text === '.') return null
  const value = Number(text.endsWith('.') ? text.slice(0, -1) : text)
  return Number.isFinite(value) ? value : null
}
