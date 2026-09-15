import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/session'
import { loadTrackedNutrients } from '~~/server/utils/nutrition/trackedNutrients'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return loadTrackedNutrients(db, userId)
})
