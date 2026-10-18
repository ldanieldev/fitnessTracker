import { googleHealthConnections } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { googleHealthConfig } from '~~/server/utils/googleHealth/config'
import { connectValues, loadConnection } from '~~/server/utils/googleHealth/connection'
import { encryptToken } from '~~/server/utils/googleHealth/crypto'
import { revokeStoredGrant } from '~~/server/utils/googleHealth/disconnect'
import { GOOGLE_HEALTH_SCOPES } from '~~/server/utils/googleHealth/scopes'
import { inngest } from '~~/server/utils/inngest/client'
import { logger } from '~~/server/utils/logger'
import { requestRoute } from '~~/server/utils/requestLog'
import { forbidToken, requireUserId, validSessionUserId } from '~~/server/utils/session'

const DONE = '/settings/data?googleHealth='

const oauth = defineOAuthGoogleEventHandler({
  config: { scope: GOOGLE_HEALTH_SCOPES, authorizationParams: { access_type: 'offline', prompt: 'consent' } },
  async onSuccess(event, { user, tokens }) {
    // Shares Google's handler with login, so it must never sign anyone in: only a live session may attach a grant.
    const userId = await validSessionUserId(event)
    if (!userId) return sendRedirect(event, '/auth/login')
    if (!tokens.refresh_token || !user.email) {
      logger.warn(
        { userId, hasRefreshToken: Boolean(tokens.refresh_token), hasEmail: Boolean(user.email) },
        'Google Health connect refused: Google sent no refresh token or email'
      )
      return sendRedirect(event, `${DONE}error`)
    }
    const googleSub = String(user.sub)
    const previous = await loadConnection(userId)
    // Revoking drops the app's whole grant, so a same-account reconnect keeps the old token to spare the new one.
    if (previous && previous.googleSub !== googleSub) {
      logger.info({ userId }, 'Google Health connection switched to a different Google account')
      await revokeStoredGrant(previous)
    }
    const scopes = String(tokens.scope ?? '')
      .split(' ')
      .filter(Boolean)
    const values = connectValues(previous, {
      googleSub,
      googleEmail: String(user.email),
      refreshTokenEnc: encryptToken(tokens.refresh_token, googleHealthConfig().tokenKey),
      scopes
    })
    await db
      .insert(googleHealthConnections)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: googleHealthConnections.userId, set: values })
    logger.info({ userId, scopes }, 'Google Health connected')
    try {
      await inngest.send({ name: 'google-health/sync.requested', data: { userId, full: true } })
    } catch (error) {
      logger.warn({ err: error, userId }, 'Google Health first sync not queued')
    }
    return sendRedirect(event, `${DONE}connected`)
  },
  onError(event, error) {
    logger.error({ err: error, route: requestRoute(event) }, 'Google Health connect failed')
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
