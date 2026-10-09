import { listPrograms } from '~~/server/utils/workouts/programs'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return listPrograms(userId)
})
