import { listReference } from '~~/server/utils/workouts/categories'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return listReference(userId)
})
