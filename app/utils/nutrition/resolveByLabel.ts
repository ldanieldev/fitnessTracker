import type { FoodForResolve, MassUnit, UnitSelection } from '~~/shared/types/nutrition'
import { NoWeightBasisError, resolveNutrition } from '~~/shared/utils/nutritionResolve'
import { availableUnits } from '~~/app/composables/useFoodUnits'

export function selectionForLabel(food: FoodForResolve, unitLabel: string): UnitSelection | null {
  const unit = availableUnits(food).find((u) => u.value === unitLabel)
  if (!unit) return null
  return unit.kind === 'mass' ? { type: 'mass', unit: unit.value as MassUnit } : { type: 'serving', servingId: unit.servingId! }
}

export function resolveByLabel(food: FoodForResolve, unitLabel: string, quantity: number): Record<number, number> | null {
  if (!(quantity > 0)) return null
  const selection = selectionForLabel(food, unitLabel)
  if (!selection) return null
  try {
    return resolveNutrition(food, selection, quantity).nutrients
  } catch (err) {
    if (err instanceof NoWeightBasisError) return null
    throw err
  }
}
