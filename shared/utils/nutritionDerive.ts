export const ATWATER = { protein: 4, carbohydrate: 4, fat: 9 } as const

export const ENERGY_MACROS = Object.keys(ATWATER) as (keyof typeof ATWATER)[]

export function hasMacro(keys: Iterable<string>): boolean {
  for (const key of keys) {
    if ((ENERGY_MACROS as string[]).includes(key)) return true
  }
  return false
}

export interface MacroInput {
  protein?: number | null
  carbohydrate?: number | null
  fat?: number | null
}

export function deriveEnergy(macros: MacroInput): number | null {
  const present = ENERGY_MACROS.filter((k) => macros[k] !== undefined && macros[k] !== null)
  if (present.length === 0) return null
  return present.reduce((sum, k) => sum + (macros[k] as number) * ATWATER[k], 0)
}

export function calculatedEnergy(macros: MacroInput): number {
  return (
    (macros.protein ?? 0) * ATWATER.protein +
    (macros.carbohydrate ?? 0) * ATWATER.carbohydrate +
    (macros.fat ?? 0) * ATWATER.fat
  )
}

export interface EnergyMismatch {
  sourceKcal: number
  macroKcal: number
}

export function sourceEnergyMismatch(nutrients: Partial<Record<string, number>>): EnergyMismatch | null {
  const source = nutrients.energy
  if (source === undefined || source === null) return null
  const present = Object.keys(nutrients).filter((k) => nutrients[k] !== undefined && nutrients[k] !== null)
  if (!hasMacro(present)) return null
  const macroKcal = calculatedEnergy(nutrients)
  const gap = Math.abs(source - macroKcal)
  return gap > 20 && gap > 0.15 * source ? { sourceKcal: source, macroKcal } : null
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
