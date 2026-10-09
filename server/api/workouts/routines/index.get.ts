import { listRoutines } from '~~/server/utils/workouts/routines'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return listRoutines(userId)
})
