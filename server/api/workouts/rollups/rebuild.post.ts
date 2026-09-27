import { rebuildRollups } from '~~/server/utils/workouts/rollups'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return rebuildRollups(userId)
})
