export const ATWATER = { protein: 4, carbohydrate: 4, fat: 9 } as const

export interface MacroInput {
  protein?: number | null
  carbohydrate?: number | null
  fat?: number | null
}

export function deriveEnergy(macros: MacroInput): number | null {
  const present = (Object.keys(ATWATER) as (keyof typeof ATWATER)[]).filter(
    (k) => macros[k] !== undefined && macros[k] !== null
  )
  if (present.length === 0) return null
  return present.reduce((sum, k) => sum + (macros[k] as number) * ATWATER[k], 0)
}

export function energyDensity(energy: number | null, basisGrams: number | null): number | null {
  if (energy === null || basisGrams === null || basisGrams <= 0) return null
  return energy * (100 / basisGrams)
}

export function scaleSnapshot(
  snapshot: Record<number, number>,
  fromQuantity: number,
  toQuantity: number
): Record<number, number> {
  if (!(fromQuantity > 0)) {
    throw new Error('Source quantity must be positive')
  }
  const ratio = toQuantity / fromQuantity
  const out: Record<number, number> = {}
  for (const [id, amount] of Object.entries(snapshot)) {
    out[Number(id)] = amount * ratio
  }
  return out
}
