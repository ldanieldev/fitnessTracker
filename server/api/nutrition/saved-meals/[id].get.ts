import { db } from '~~/server/utils/db'
import { loadSavedMeal } from '~~/server/utils/nutrition/savedMeal'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid saved meal ID' })
  }

  const savedMeal = await loadSavedMeal(db, userId, id)
  if (!savedMeal) throw createError({ statusCode: 404, statusMessage: 'Saved meal not found' })

  return savedMeal
})
