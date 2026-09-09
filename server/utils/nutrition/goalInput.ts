import { z } from 'zod'
import type { TargetDirection } from '~~/shared/types/nutrition'
import { RATIO_MACROS, ratioToGrams } from '~~/shared/utils/nutritionGoals'
import type { NutrientCatalogEntry } from './nutrientIds'

export const goalTargetInputSchema = z.object({
  nutrient: z.string().min(1),
  amount: z.number().nonnegative().optional(),
  ratioPercent: z.number().min(0).max(100).optional(),
  direction: z.enum(['min', 'max', 'target']).optional()
})

export const goalProfileSchema = z.object({
  name: z.string().min(1).max(255),
  inputMode: z.enum(['grams', 'ratio']),
  calories: z.number().positive().nullish(),
  isDefault: z.boolean().default(false),
  targets: z.array(goalTargetInputSchema).min(1)
})

export type GoalTargetInput = z.infer<typeof goalTargetInputSchema>
export type GoalProfileInput = z.infer<typeof goalProfileSchema>

export interface PreparedGoalTarget {
  nutrientId: number
  amount: number
  direction: TargetDirection
  ratioPercent: number | null
}

export function buildGoalTargetRows(
  input: GoalProfileInput,
  catalog: NutrientCatalogEntry[]
): PreparedGoalTarget[] {
  const byKey = new Map(catalog.map((n) => [n.key, n]))

  let macroGrams: Record<string, number> | null = null
  if (input.inputMode === 'ratio') {
    if (!input.calories) throw new Error('calories is required for ratio mode')
    const ratios = {} as Record<(typeof RATIO_MACROS)[number], number>
    for (const macro of RATIO_MACROS) {
      const target = input.targets.find((t) => t.nutrient === macro)
      if (!target || target.ratioPercent === undefined) {
        throw new Error(`ratioPercent is required for ${macro} in ratio mode`)
      }
      ratios[macro] = target.ratioPercent
    }
    macroGrams = ratioToGrams(input.calories, ratios)
  }

  return input.targets.map((target) => {
    const entry = byKey.get(target.nutrient)
    if (!entry) throw new Error(`Unknown nutrient: ${target.nutrient}`)

    const isRatioMacro = input.inputMode === 'ratio' && (RATIO_MACROS as readonly string[]).includes(target.nutrient)

    let amount: number
    let ratioPercent: number | null = null
    if (isRatioMacro) {
      amount = macroGrams![target.nutrient]!
      ratioPercent = target.ratioPercent!
    } else {
      if (target.amount === undefined) throw new Error(`amount is required for ${target.nutrient}`)
      amount = target.amount
    }

    return { nutrientId: entry.id, amount, direction: target.direction ?? entry.defaultDirection, ratioPercent }
  })
}
