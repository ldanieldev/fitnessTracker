import { syncGoogleHealth, toSyncResult } from '~~/server/utils/googleHealth/sync'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const result = await syncGoogleHealth(await requireUserId(event))
  if (result.outcome === 'not_connected') {
    throw createError({ statusCode: 404, statusMessage: 'Google Health is not connected' })
  }
  if (result.outcome === 'busy') throw createError({ statusCode: 409, statusMessage: 'A sync is already running' })
  return toSyncResult(result)
})
