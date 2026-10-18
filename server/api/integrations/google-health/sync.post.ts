import { loadConnection, syncCooldownSeconds } from '~~/server/utils/googleHealth/connection'
import { syncGoogleHealth, toSyncResult } from '~~/server/utils/googleHealth/sync'
import { logger } from '~~/server/utils/logger'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const conn = await loadConnection(userId)
  const wait = conn ? syncCooldownSeconds(conn, Date.now(), useRuntimeConfig().googleHealth.syncCooldownSeconds) : 0
  if (wait > 0) {
    setResponseHeader(event, 'Retry-After', wait)
    throw createError({ statusCode: 429, statusMessage: `Synced moments ago; try again in ${wait} s` })
  }
  const result = await syncGoogleHealth(userId)
  logger.info({ userId, outcome: result.outcome }, 'Google Health manual sync finished')
  if (result.outcome === 'not_connected') {
    throw createError({ statusCode: 404, statusMessage: 'Google Health is not connected' })
  }
  if (result.outcome === 'busy') throw createError({ statusCode: 409, statusMessage: 'A sync is already running' })
  return toSyncResult(result)
})
