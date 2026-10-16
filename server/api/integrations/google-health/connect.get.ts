import { googleHealthConnections } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { googleHealthConfig } from '~~/server/utils/googleHealth/config'
import { loadConnection } from '~~/server/utils/googleHealth/connection'
import { encryptToken } from '~~/server/utils/googleHealth/crypto'
import { revokeStoredGrant } from '~~/server/utils/googleHealth/disconnect'
import { GOOGLE_HEALTH_SCOPES } from '~~/server/utils/googleHealth/scopes'
import { inngest } from '~~/server/utils/inngest/client'
import { logger } from '~~/server/utils/logger'
import { forbidToken, requireUserId, validSessionUserId } from '~~/server/utils/session'

const DONE = '/settings/data?googleHealth='

const oauth = defineOAuthGoogleEventHandler({
  config: { scope: GOOGLE_HEALTH_SCOPES, authorizationParams: { access_type: 'offline', prompt: 'consent' } },
  async onSuccess(event, { user, tokens }) {
    // Shares Google's handler with login, so it must never sign anyone in: only a live session may attach a grant.
    const userId = await validSessionUserId(event)
    if (!userId) return sendRedirect(event, '/auth/login')
    if (!tokens.refresh_token || !user.email) return sendRedirect(event, `${DONE}error`)
    const googleSub = String(user.sub)
    const previous = await loadConnection(userId)
    // Revoking drops the app's whole grant, so a same-account reconnect keeps the old token to spare the new one.
    if (previous && previous.googleSub !== googleSub) await revokeStoredGrant(previous)
    const values = {
      googleSub,
      googleEmail: String(user.email),
      refreshTokenEnc: encryptToken(tokens.refresh_token, googleHealthConfig().tokenKey),
      scopes: String(tokens.scope ?? '')
        .split(' ')
        .filter(Boolean),
      status: 'active' as const,
      lastError: null,
      syncStartedAt: null
    }
    await db
      .insert(googleHealthConnections)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: googleHealthConnections.userId, set: values })
    try {
      await inngest.send({ name: 'google-health/sync.requested', data: { userId, full: true } })
    } catch (error) {
      logger.warn({ err: error, userId }, 'Google Health first sync not queued')
    }
    return sendRedirect(event, `${DONE}connected`)
  },
  onError(event) {
    return sendRedirect(event, `${DONE}error`)
  }
})

export default defineEventHandler(async (event) => {
  forbidToken(event)
  await requireUserId(event)
  // nuxt-auth-utils restarts the flow on ?error without a code (Cancel loops to consent); end it here instead.
  if (getQuery(event).error) return sendRedirect(event, `${DONE}error`)
  if (!googleHealthConfig().available) {
    throw createError({ statusCode: 404, statusMessage: 'Google Health is not set up on this server' })
  }
  return oauth(event)
})
