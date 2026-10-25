import type { EnergyMismatch } from '~~/shared/utils/nutritionDerive'

export function energyMismatchMessage(mismatch: EnergyMismatch, source: string | null): string {
  const sourceKcal = Math.round(mismatch.sourceKcal)
  const macroKcal = Math.round(mismatch.macroKcal)
  const lead = source ? `${source} says ${sourceKcal} kcal per 100 g` : `The label says ${sourceKcal} kcal`
  return `${lead}, the macros give ${macroKcal}. Check the macros against the label.`
}
