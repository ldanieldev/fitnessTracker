import { disconnectGoogleHealth } from '~~/server/utils/googleHealth/disconnect'
import { forbidToken, requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  forbidToken(event)
  await disconnectGoogleHealth(await requireUserId(event))
  return { ok: true }
})
