import { and, eq, isNull } from 'drizzle-orm'
import { savedMeals } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { describeLines } from '~~/server/utils/nutrition/libraryLines'
import { loadSavedMeal } from '~~/server/utils/nutrition/savedMeal'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const heads = await db
    .select({ id: savedMeals.id, name: savedMeals.name })
    .from(savedMeals)
    .where(and(eq(savedMeals.userId, userId), isNull(savedMeals.deletedAt)))

  return Promise.all(
    heads.map(async (head) => {
      const meal = await loadSavedMeal(db, userId, head.id)
      const described = meal ? await describeLines(db, userId, meal.items) : { lines: [], total: {} }
      return { ...head, itemCount: described.lines.length, total: described.total }
    })
  )
})
