import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { FoodForResolve } from '~~/shared/types/nutrition'
import { NoWeightBasisError, defaultServing, resolveNutrition } from '~~/shared/utils/nutritionResolve'
import { foodNutrients, foods, foodServings } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { type ServingNutrientRow, toFoodForResolve } from '~~/server/utils/nutrition/loadFood'
import { getNutrientId, nutrientCatalog } from '~~/server/utils/nutrition/nutrientIds'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { perDefaultOf } from '~~/server/utils/nutrition/perDefault'
import { escapeLike } from '~~/server/utils/nutrition/postgresSearch'
import { requireUserId } from '~~/server/utils/session'

const listQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100)
})

function defaultEnergy(food: FoodForResolve, energyId: number): number | null {
  const serving = defaultServing(food)
  if (!serving) return null
  try {
    return resolveNutrition(food, { type: 'serving', servingId: serving.id }, serving.quantity).nutrients[energyId] ?? null
  } catch (err) {
    if (err instanceof NoWeightBasisError) return null
    throw err
  }
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { q, limit } = parseQuery(event, listQuerySchema)

  const pattern = q ? `%${escapeLike(q)}%` : null
  const heads = await db
    .select({ id: foods.id, name: foods.name, brand: foods.brand })
    .from(foods)
    .where(
      and(
        eq(foods.createdByUserId, userId),
        isNull(foods.deletedAt),
        pattern
          ? or(sql`${foods.name} ilike ${pattern} escape '\\'`, sql`${foods.brand} ilike ${pattern} escape '\\'`)
          : undefined
      )
    )
    .orderBy(asc(foods.name), asc(foods.id))
    .limit(limit)

  if (heads.length === 0) return []

  const rows = await db
    .select({
      foodId: foodServings.foodId,
      servingId: foodServings.id,
      kind: foodServings.kind,
      label: foodServings.label,
      quantity: foodServings.quantity,
      basisGrams: foodServings.basisGrams,
      hasOwnNutrition: foodServings.hasOwnNutrition,
      nutrientId: foodNutrients.nutrientId,
      amount: foodNutrients.amount
    })
    .from(foodServings)
    .leftJoin(foodNutrients, eq(foodNutrients.foodServingId, foodServings.id))
    .where(and(inArray(foodServings.foodId, heads.map((h) => h.id)), isNull(foodServings.deletedAt)))

  const rowsByFood = new Map<number, ServingNutrientRow[]>()
  for (const { foodId, ...row } of rows) {
    const list = rowsByFood.get(foodId) ?? []
    list.push(row as ServingNutrientRow)
    rowsByFood.set(foodId, list)
  }

  const energyId = await getNutrientId('energy')
  const idToKey = new Map((await nutrientCatalog()).map((n) => [n.id, n.key]))

  return heads.map((head) => {
    const food = toFoodForResolve(head.id, rowsByFood.get(head.id) ?? [])
    const serving = defaultServing(food)
    return {
      id: head.id,
      name: head.name,
      brand: head.brand,
      defaultServing: serving ? { label: serving.label, quantity: serving.quantity } : null,
      energy: defaultEnergy(food, energyId),
      perDefault: perDefaultOf(food, idToKey)
    }
  })
})
