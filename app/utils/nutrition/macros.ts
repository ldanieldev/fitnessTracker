export type MacroKey = 'energy' | 'protein' | 'carbohydrate' | 'fat'

export const MACRO_CLASS: Record<MacroKey | 'other', string> = {
  energy: 'text-primary',
  protein: 'text-protein',
  carbohydrate: 'text-carb',
  fat: 'text-fat',
  other: 'text-macro-other'
}

export const MACRO_SHORT: Record<MacroKey, string> = { energy: 'kcal', protein: 'P', carbohydrate: 'C', fat: 'F' }

const PCF: MacroKey[] = ['protein', 'carbohydrate', 'fat']

export function formatAmount(key: string, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (key === 'energy') return Math.round(value).toString()
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)
}

export interface MacroPart {
  key: string
  label: string
  text: string
  cls: string
}

export function macroParts(
  nutrients: Record<string, number | null | undefined>,
  opts: { extras?: Array<{ key: string, name: string, unit: string }>, withEnergy?: boolean } = {}
): MacroPart[] {
  const parts: MacroPart[] = []
  if (opts.withEnergy) parts.push({ key: 'energy', label: MACRO_SHORT.energy, text: formatAmount('energy', nutrients.energy), cls: MACRO_CLASS.energy })
  for (const key of PCF) parts.push({ key, label: MACRO_SHORT[key], text: formatAmount(key, nutrients[key]), cls: MACRO_CLASS[key] })
  for (const extra of opts.extras ?? []) {
    const value = nutrients[extra.key]
    if (value === null || value === undefined) continue
    parts.push({ key: extra.key, label: extra.name.slice(0, 3), text: formatAmount(extra.key, value), cls: MACRO_CLASS.other })
  }
  return parts
}
