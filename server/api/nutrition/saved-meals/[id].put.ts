import { eq } from 'drizzle-orm'
import { savedMealItems, savedMeals } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadFood } from '~~/server/utils/nutrition/loadFood'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { type PreparedIngredient, resolveIngredientGrams } from '~~/server/utils/nutrition/recipeInput'
import { loadSavedMeal } from '~~/server/utils/nutrition/savedMeal'
import { savedMealSchema } from '~~/server/utils/nutrition/savedMealInput'
import { requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = routeId(event)

  const existing = await loadSavedMeal(db, userId, id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Saved meal not found' })

  const body = await parseBody(event, savedMealSchema)

  const prepared: PreparedIngredient[] = []
  for (const item of body.items) {
    const food = await loadFood(db, userId, item.foodId)
    if (!food) throw createError({ statusCode: 404, statusMessage: `Food not found: ${item.foodId}` })
    prepared.push(resolveIngredientGrams(food, item))
  }

  return db.transaction(async (tx) => {
    await tx.update(savedMeals).set({ name: body.name }).where(eq(savedMeals.id, id))

    await tx.delete(savedMealItems).where(eq(savedMealItems.savedMealId, id))

    await tx.insert(savedMealItems).values(
      prepared.map((item, sortOrder) => ({
        savedMealId: id,
        foodId: item.foodId,
        foodServingId: item.foodServingId,
        quantity: String(item.quantity),
        unitLabel: item.unitLabel,
        gramsResolved: item.gramsResolved === null ? null : String(item.gramsResolved),
        sortOrder
      }))
    )

    return { id }
  })
})
