import type { FoodForResolve, ResolveResult, ServingBasis, UnitSelection } from '../types/nutrition'
import { toGrams } from './nutritionUnits'

export class NoWeightBasisError extends Error {
  code = 'NO_WEIGHT_BASIS'
  constructor() {
    super('This food has no gram basis, so it cannot be logged by weight')
    this.name = 'NoWeightBasisError'
  }
}

function scale(nutrients: Record<number, number>, ratio: number): Record<number, number> {
  const out: Record<number, number> = {}
  for (const [id, amount] of Object.entries(nutrients)) {
    out[Number(id)] = amount * ratio
  }
  return out
}

export function selectGramBasis(food: FoodForResolve): ServingBasis | null {
  const weight = food.servings.find((s) => s.kind === 'weight')
  if (weight) return weight
  const candidates = food.servings
    .filter((s) => s.hasOwnNutrition && s.basisGrams !== null)
    .sort((a, b) => a.id - b.id)
  return candidates[0] ?? null
}

export function defaultServing(food: FoodForResolve): ServingBasis | null {
  const weight = food.servings.find((s) => s.kind === 'weight')
  if (weight) return weight
  return [...food.servings].sort((a, b) => a.id - b.id)[0] ?? null
}

export function resolveNutrition(
  food: FoodForResolve,
  selection: UnitSelection,
  quantity: number
): ResolveResult {
  if (!(quantity > 0)) {
    throw new Error('Quantity must be positive')
  }

  if (selection.type === 'mass') {
    const grams = toGrams(quantity, selection.unit)
    const basis = selectGramBasis(food)
    if (!basis || basis.basisGrams === null || !(basis.basisGrams > 0)) {
      throw new NoWeightBasisError()
    }
    return { nutrients: scale(basis.nutrients, grams / basis.basisGrams), gramsResolved: grams }
  }

  const serving = food.servings.find((s) => s.id === selection.servingId)
  if (!serving) {
    throw new Error(`Unknown serving ${selection.servingId}`)
  }

  const gramsPerOne = serving.basisGrams === null ? null : serving.basisGrams / serving.quantity

  if (!serving.hasOwnNutrition) {
    if (gramsPerOne === null || !(gramsPerOne > 0)) {
      throw new NoWeightBasisError()
    }
    return resolveNutrition(food, { type: 'mass', unit: 'g' }, gramsPerOne * quantity)
  }

  return {
    nutrients: scale(serving.nutrients, quantity / serving.quantity),
    gramsResolved: gramsPerOne === null ? null : gramsPerOne * quantity
  }
}
