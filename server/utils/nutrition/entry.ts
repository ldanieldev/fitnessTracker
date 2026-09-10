import { z } from 'zod'
import type { FoodForResolve, UnitSelection } from '~~/shared/types/nutrition'
import { deriveEnergy } from '~~/shared/utils/nutritionDerive'
import { NoWeightBasisError, resolveNutrition } from '~~/shared/utils/nutritionResolve'
import { normalizeUnitLabel } from '~~/shared/utils/nutritionUnits'
import { diaryEntries, diaryEntryNutrients } from '~~/server/db/schema'
import type { DbClient } from '../db'
import { loadFood } from './loadFood'
import { computeRecipeNutrition, loadRecipe } from './recipeTotals'
import { recordFoodUsage } from './usage'

export const entryInputSchema = z.object({
  entryType: z.enum(['food', 'quick_add', 'recipe']),
  containerId: z.number().int(),
  quantity: z.number().positive(),
  unitLabel: z.string().trim().min(1).max(64),
  foodId: z.number().int().nullish(),
  recipeId: z.number().int().nullish(),
  savedMealId: z.number().int().nullish(),
  description: z.string().max(255).nullish(),
  loggedAt: z.coerce.date().optional(),
  notes: z.string().max(2000).nullish(),
  nutrients: z.record(z.string(), z.number()).optional()
})

export const entryPostSchema = z.array(entryInputSchema).min(1)

export type EntryInput = z.infer<typeof entryInputSchema>

export interface WriteEntryArgs {
  dayId: number
  containerId: number
  sortOrder: number
  entryType: 'food' | 'quick_add' | 'recipe'
  quantity: number
  unitLabel: string
  gramsResolved: number | null
  foodId?: number | null
  foodServingId?: number | null
  recipeId?: number | null
  description?: string | null
  brandSnapshot?: string | null
  ingredientSnapshot?: unknown
  notes?: string | null
  loggedAt?: Date
  importKey?: string | null
  nutrients: Record<number, number>
}

export async function writeEntry(tx: DbClient, args: WriteEntryArgs) {
  const entry = await tx
    .insert(diaryEntries)
    .values({
      dayId: args.dayId,
      containerId: args.containerId,
      sortOrder: args.sortOrder,
      loggedAt: args.loggedAt ?? new Date(),
      entryType: args.entryType,
      foodId: args.foodId ?? null,
      foodServingId: args.foodServingId ?? null,
      recipeId: args.recipeId ?? null,
      quantity: String(args.quantity),
      unitLabel: args.unitLabel,
      gramsResolved: args.gramsResolved === null ? null : String(args.gramsResolved),
      description: args.description ?? null,
      brandSnapshot: args.brandSnapshot ?? null,
      ingredientSnapshot: args.ingredientSnapshot ?? null,
      notes: args.notes ?? null,
      importKey: args.importKey ?? null
    })
    .returning({ id: diaryEntries.id })
    .then((r) => r[0]!)

  const rows = Object.entries(args.nutrients).map(([nutrientId, amount]) => ({
    entryId: entry.id,
    nutrientId: Number(nutrientId),
    amount: String(amount)
  }))
  if (rows.length) {
    await tx.insert(diaryEntryNutrients).values(rows)
  }
  return entry
}

export function selectUnit(
  food: FoodForResolve,
  rawLabel: string
): { selection: UnitSelection, unitLabel: string, foodServingId: number | null } {
  const normalized = normalizeUnitLabel(rawLabel)
  if (normalized.kind === 'weight') {
    return { selection: { type: 'mass', unit: normalized.unit }, unitLabel: normalized.unit, foodServingId: null }
  }
  const serving = food.servings.find((s) => s.label === normalized.label)
  if (!serving) throw createError({ statusCode: 400, statusMessage: 'Unknown serving unit' })
  return { selection: { type: 'serving', servingId: serving.id }, unitLabel: normalized.label, foodServingId: serving.id }
}

export async function resolveEntryInput(
  tx: DbClient,
  userId: number,
  input: EntryInput,
  nutrientIds: Map<string, number>
): Promise<Omit<WriteEntryArgs, 'dayId' | 'sortOrder'>> {
  if (input.entryType === 'recipe') {
    if (!input.recipeId) {
      throw createError({ statusCode: 400, statusMessage: 'recipeId is required for a recipe entry' })
    }
    const recipe = await loadRecipe(tx, userId, input.recipeId)
    if (!recipe) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })

    const nutrition = await computeRecipeNutrition(tx, userId, recipe)
    if (nutrition.brokenIngredients.length > 0) {
      throw createError({ statusCode: 400, statusMessage: 'RECIPE_INGREDIENT_MISSING' })
    }

    const ratio = input.quantity / recipe.servings

    const nutrients: Record<number, number> = {}
    for (const [id, amount] of Object.entries(nutrition.perServing)) {
      nutrients[Number(id)] = amount * input.quantity
    }

    const catalogById = new Map<number, string>()
    for (const [key, id] of nutrientIds.entries()) catalogById.set(id, key)

    const ingredientSnapshot = nutrition.ingredients.map((ingredient) => ({
      foodId: ingredient.foodId,
      name: ingredient.name,
      quantity: ingredient.quantity * ratio,
      unitLabel: ingredient.unitLabel,
      gramsResolved: ingredient.gramsResolved === null ? null : ingredient.gramsResolved * ratio,
      nutrients: Object.fromEntries(
        Object.entries(ingredient.nutrients).flatMap(([id, amount]) => {
          const key = catalogById.get(Number(id))
          return key ? [[key, amount * ratio]] : []
        })
      )
    }))

    return {
      containerId: input.containerId,
      entryType: 'recipe',
      quantity: input.quantity,
      unitLabel: recipe.servingName,
      gramsResolved: null,
      foodId: null,
      foodServingId: null,
      recipeId: recipe.id,
      description: recipe.name,
      ingredientSnapshot,
      notes: input.notes ?? null,
      loggedAt: input.loggedAt,
      nutrients
    }
  }

  if (input.entryType === 'quick_add') {
    if (!input.description) {
      throw createError({ statusCode: 400, statusMessage: 'description is required for a quick add' })
    }

    const nutrients: Record<number, number> = {}
    for (const [key, amount] of Object.entries(input.nutrients ?? {})) {
      const nutrientId = nutrientIds.get(key)
      if (!nutrientId) throw createError({ statusCode: 400, statusMessage: `Unknown nutrient: ${key}` })
      nutrients[nutrientId] = amount
    }

    const energyId = nutrientIds.get('energy')
    if (energyId && nutrients[energyId] === undefined) {
      const proteinId = nutrientIds.get('protein')
      const carbId = nutrientIds.get('carbohydrate')
      const fatId = nutrientIds.get('fat')
      const derived = deriveEnergy({
        protein: proteinId !== undefined ? nutrients[proteinId] : undefined,
        carbohydrate: carbId !== undefined ? nutrients[carbId] : undefined,
        fat: fatId !== undefined ? nutrients[fatId] : undefined
      })
      if (derived !== null) nutrients[energyId] = derived
    }

    const normalizedUnit = normalizeUnitLabel(input.unitLabel)
    const unitLabel = normalizedUnit.kind === 'weight' ? normalizedUnit.unit : normalizedUnit.label

    return {
      containerId: input.containerId,
      entryType: 'quick_add',
      quantity: input.quantity,
      unitLabel,
      gramsResolved: null,
      description: input.description,
      notes: input.notes ?? null,
      loggedAt: input.loggedAt,
      nutrients
    }
  }

  if (!input.foodId) {
    throw createError({ statusCode: 400, statusMessage: 'foodId is required for a food entry' })
  }
  const food = await loadFood(tx, userId, input.foodId)
  if (!food) throw createError({ statusCode: 404, statusMessage: 'Food not found' })

  const { selection, unitLabel, foodServingId } = selectUnit(food, input.unitLabel)

  let resolved
  try {
    resolved = resolveNutrition(food, selection, input.quantity)
  } catch (err) {
    if (err instanceof NoWeightBasisError) {
      throw createError({ statusCode: 400, statusMessage: 'NO_WEIGHT_BASIS', data: { code: 'NO_WEIGHT_BASIS' } })
    }
    throw err
  }

  await recordFoodUsage(tx, userId, food.id)

  return {
    containerId: input.containerId,
    entryType: 'food',
    quantity: input.quantity,
    unitLabel,
    gramsResolved: resolved.gramsResolved,
    foodId: food.id,
    foodServingId,
    description: food.name,
    brandSnapshot: food.brand,
    notes: input.notes ?? null,
    loggedAt: input.loggedAt,
    nutrients: resolved.nutrients
  }
}
