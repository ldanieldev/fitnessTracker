import { disconnectGoogleHealth } from '~~/server/utils/googleHealth/disconnect'
import { logger } from '~~/server/utils/logger'
import { forbidToken, requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  forbidToken(event)
  const userId = await requireUserId(event)
  await disconnectGoogleHealth(userId)
  logger.info({ userId }, 'Google Health disconnected')
  return { ok: true }
})
