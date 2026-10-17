import { db } from '~~/server/utils/db'
import { describeLines, loadLineFoods } from '~~/server/utils/nutrition/libraryLines'
import { loadUserSavedMeals } from '~~/server/utils/nutrition/savedMeal'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const meals = await loadUserSavedMeals(db, userId)
  const foods = await loadLineFoods(
    db,
    userId,
    meals.flatMap((meal) => meal.items.map((item) => item.foodId))
  )

  return Promise.all(
    meals.map(async (meal) => {
      const described = await describeLines(db, userId, meal.items, foods)
      return { id: meal.id, name: meal.name, itemCount: described.lines.length, total: described.total }
    })
  )
})
