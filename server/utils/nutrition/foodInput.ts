import { z } from 'zod'
import type { ServingKind } from '~~/shared/types/nutrition'
import { deriveEnergy } from '~~/shared/utils/nutritionDerive'
import { normalizeUnitLabel, toGrams } from '~~/shared/utils/nutritionUnits'

export const servingInputSchema = z.object({
  kind: z.enum(['weight', 'named']),
  label: z.string().min(1).max(64),
  quantity: z.number().positive(),
  basisGrams: z.number().positive().nullish(),
  nutrients: z.record(z.string(), z.number()).optional()
})

export const foodCreateSchema = z.object({
  name: z.string().min(1).max(255),
  brand: z.string().max(255).nullish(),
  barcode: z.string().max(64).nullish(),
  servings: z.array(servingInputSchema).min(1)
})

export type ServingInput = z.infer<typeof servingInputSchema>

export interface PreparedServing {
  kind: ServingKind
  label: string
  quantity: number
  basisGrams: number | null
  hasOwnNutrition: boolean
  origin: 'user'
  sortOrder: number
  nutrients: Array<{ nutrientId: number, amount: number }>
}

export function buildServingRows(
  inputs: ServingInput[],
  nutrientIds: Map<string, number>
): PreparedServing[] {
  if (inputs.filter((s) => s.kind === 'weight').length > 1) {
    throw new Error('A food may have at most one weight serving')
  }

  return inputs.map((input, sortOrder) => {
    const normalized = normalizeUnitLabel(input.label)
    const label = normalized.kind === 'weight' ? normalized.unit : normalized.label

    let basisGrams = input.basisGrams ?? null
    if (input.kind === 'weight') {
      if (normalized.kind !== 'weight') {
        throw new Error(`"${input.label}" is not a weight unit`)
      }
      basisGrams = toGrams(input.quantity, normalized.unit)
    }

    const raw = input.nutrients ?? {}
    const hasOwnNutrition = Object.keys(raw).length > 0
    if (!hasOwnNutrition && basisGrams === null) {
      throw new Error('A serving without its own nutrition needs a gram weight')
    }
    if (input.kind === 'weight' && !hasOwnNutrition) {
      throw new Error('A weight serving must carry its own nutrition')
    }

    const values = { ...raw }
    const macrosComplete = values.protein !== undefined && values.carbohydrate !== undefined && values.fat !== undefined
    if (hasOwnNutrition && values.energy === undefined && macrosComplete) {
      const derived = deriveEnergy({
        protein: values.protein,
        carbohydrate: values.carbohydrate,
        fat: values.fat
      })
      if (derived !== null) values.energy = derived
    }

    const nutrients = Object.entries(values).map(([key, amount]) => {
      const nutrientId = nutrientIds.get(key)
      if (!nutrientId) throw new Error(`Unknown nutrient: ${key}`)
      return { nutrientId, amount }
    })

    return { kind: input.kind, label, quantity: input.quantity, basisGrams, hasOwnNutrition,
      origin: 'user' as const, sortOrder, nutrients }
  })
}
