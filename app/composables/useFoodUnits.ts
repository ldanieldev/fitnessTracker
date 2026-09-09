import type { FoodForResolve } from '~~/shared/types/nutrition'
import { defaultServing, selectGramBasis } from '~~/shared/utils/nutritionResolve'

export interface UnitOption {
  value: string
  label: string
  kind: 'mass' | 'serving'
  servingId?: number
}

export function availableUnits(food: FoodForResolve): UnitOption[] {
  const mass: UnitOption[] = selectGramBasis(food)
    ? (['g', 'oz', 'lb'] as const).map((u) => ({ value: u, label: u, kind: 'mass' as const }))
    : []

  const named = food.servings
    .filter((s) => s.kind !== 'weight')
    .map((s) => ({
      value: s.label,
      label: s.quantity === 1 ? s.label : `${s.quantity} ${s.label}`,
      kind: 'serving' as const,
      servingId: s.id
    }))

  return [...mass, ...named]
}

export function defaultUnit(food: FoodForResolve): string {
  const weight = food.servings.find((s) => s.kind === 'weight')
  return weight ? 'g' : (defaultServing(food)?.label ?? 'g')
}
