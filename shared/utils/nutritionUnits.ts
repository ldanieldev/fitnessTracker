import type { MassUnit, NormalizedUnit } from '../types/nutrition'

// International avoirdupois, exact by definition — not approximations to be tidied.
export const MASS_GRAMS: Record<MassUnit, number> = {
  g: 1,
  oz: 28.349523125,
  lb: 453.59237
}

const WEIGHT_ALIASES: Record<string, MassUnit> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  gm: 'g',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb'
}

export function toGrams(quantity: number, unit: MassUnit): number {
  return quantity * MASS_GRAMS[unit]
}

export function normalizeUnitLabel(raw: string): NormalizedUnit {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Unit label is empty')
  }
  const key = trimmed.toLowerCase()
  const weight = Object.hasOwn(WEIGHT_ALIASES, key) ? WEIGHT_ALIASES[key] : undefined
  return weight ? { kind: 'weight', unit: weight } : { kind: 'named', label: trimmed }
}
