import { logger } from '~~/server/utils/logger'
import { rebuildRollups } from '~~/server/utils/workouts/rollups'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const startedAt = Date.now()
  const result = await rebuildRollups(userId)
  logger.info({ userId, rows: result.rows, durationMs: Date.now() - startedAt }, 'workout rollups rebuilt')
  return result
})
