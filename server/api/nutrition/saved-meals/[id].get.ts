import { db } from '~~/server/utils/db'
import { describeLines } from '~~/server/utils/nutrition/libraryLines'
import { loadSavedMeal } from '~~/server/utils/nutrition/savedMeal'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid saved meal ID' })
  }

  const savedMeal = await loadSavedMeal(db, userId, id)
  if (!savedMeal) throw createError({ statusCode: 404, statusMessage: 'Saved meal not found' })

  const described = await describeLines(db, userId, savedMeal.items)
  return { ...savedMeal, items: described.lines, total: described.total }
})
