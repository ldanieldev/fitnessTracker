import type { FoodForResolve, ServingBasis } from '~~/shared/types/nutrition'
import { selectGramBasis } from '~~/shared/utils/nutritionResolve'

export class ServingInUseError extends Error {
  code = 'SERVING_IN_USE'
  constructor() {
    super('Other servings derive their nutrition from this one')
    this.name = 'ServingInUseError'
  }
}

export function assertCanDeleteServing(food: FoodForResolve, servingId: number): void {
  const target = food.servings.find((s) => s.id === servingId)
  if (!target) {
    throw new Error(`Unknown serving ${servingId}`)
  }

  const remaining = { ...food, servings: food.servings.filter((s) => s.id !== servingId) }
  const stillDeriving = remaining.servings.some((s) => !s.hasOwnNutrition)
  if (stillDeriving && selectGramBasis(remaining) === null) {
    throw new ServingInUseError()
  }
}

export function assertCanReplaceServing(
  food: FoodForResolve,
  servingId: number,
  replacement: Pick<ServingBasis, 'kind' | 'basisGrams' | 'hasOwnNutrition'>
): void {
  const target = food.servings.find((s) => s.id === servingId)
  if (!target) {
    throw new Error(`Unknown serving ${servingId}`)
  }

  const after = {
    ...food,
    servings: food.servings.map((s) => (s.id === servingId ? { ...s, ...replacement } : s))
  }
  const stillDeriving = after.servings.some((s) => !s.hasOwnNutrition)
  if (stillDeriving && selectGramBasis(after) === null) {
    throw new ServingInUseError()
  }
}
