import { db } from '~~/server/utils/db'
import { describeLines } from '~~/server/utils/nutrition/libraryLines'
import { loadSavedMeal } from '~~/server/utils/nutrition/savedMeal'
import { requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = routeId(event)

  const savedMeal = await loadSavedMeal(db, userId, id)
  if (!savedMeal) throw createError({ statusCode: 404, statusMessage: 'Saved meal not found' })

  const described = await describeLines(db, userId, savedMeal.items)
  return { ...savedMeal, items: described.lines, total: described.total }
})
