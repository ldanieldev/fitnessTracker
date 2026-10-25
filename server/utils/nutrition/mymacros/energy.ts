import type { ImportWarning, MacroSet } from '~~/shared/types/nutrition'
import { calculatedEnergy, sourceEnergyMismatch } from '~~/shared/utils/nutritionDerive'
import type { PlannedEntry, PlannedFood } from './plan'

function macroEnergy(nutrients: MacroSet): number {
  return calculatedEnergy({ protein: nutrients.protein, carbohydrate: nutrients.carbs, fat: nutrients.fat })
}

export function entryEnergy(entry: { kind: 'food' | 'quick_add'; nutrients: MacroSet }): number {
  return entry.kind === 'quick_add' ? entry.nutrients.kcal : macroEnergy(entry.nutrients)
}

export function energyWarnings(foods: PlannedFood[], entries: PlannedEntry[]): ImportWarning[] {
  const firstDate = new Map<string, string>()
  for (const entry of entries) {
    if (entry.kind !== 'food' || !entry.foodKey) continue
    const seen = firstDate.get(entry.foodKey)
    if (seen === undefined || entry.date < seen) firstDate.set(entry.foodKey, entry.date)
  }

  const warnings: ImportWarning[] = []
  for (const food of foods) {
    const date = firstDate.get(food.key)
    if (date === undefined) continue
    for (const serving of food.servings) {
      const factor = serving.kind === 'weight' ? 100 / serving.quantity : 1
      const { kcal, protein, carbs, fat } = serving.perUnit
      const mismatch = sourceEnergyMismatch({
        energy: kcal * factor,
        protein: protein * factor,
        carbohydrate: carbs * factor,
        fat: fat * factor
      })
      if (!mismatch) continue
      const says = Math.round(mismatch.sourceKcal)
      const gives = Math.round(mismatch.macroKcal)
      const message =
        `${food.name} (${serving.label}): My Macros+ says ${says} kcal, the macros give ${gives}. ` +
        'Check the macros against the label.'
      warnings.push({ date, code: 'energy_mismatch', message })
    }
  }
  return warnings
}
