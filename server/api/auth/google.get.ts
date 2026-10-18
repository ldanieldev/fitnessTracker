import { logOAuthFlowError } from '~~/server/utils/auth'
import { validSessionUserId, writeSession } from '~~/server/utils/session'
import { toSessionUser } from '~~/server/utils/sessionUser'

const googleHandler = defineOAuthGoogleEventHandler({
  async onSuccess(event, { user: googleUser }) {
    const providerAccountId = String(googleUser.sub)
    const email: string = googleUser.email || ''
    if (!email) {
      logger.warn(
        { event: 'auth.oauth_no_email', provider: 'google', providerAccountId },
        'OAuth sign-in refused: no email'
      )
      return loginError(event, 'no_email')
    }

    if (!googleUser.email_verified) {
      logger.warn(
        { event: 'auth.oauth_email_unverified', provider: 'google', providerAccountId },
        'OAuth sign-in refused: no verified email'
      )
      return loginError(event, 'email_unverified')
    }

    let linkUserId: number | undefined
    try {
      // Only a still-valid session links; a revoked cookie must not attach this provider to its user.
      linkUserId = await validSessionUserId(event)
      const user = await findOrCreateUserAndLinkProvider(
        {
          email,
          name: googleUser.name || email,
          avatarUrl: googleUser.picture ?? undefined
        },
        {
          provider: 'google',
          providerAccountId
        },
        linkUserId
      )
      if (user.isActive === false) {
        logger.warn(
          { event: 'auth.login_disabled', userId: user.id, method: 'google' },
          'sign-in refused: account disabled'
        )
        return loginError(event, 'account_disabled')
      }

      await writeSession(event, toSessionUser(user), user.sessionEpoch)
      logger.info(
        { event: 'auth.login', userId: user.id, method: 'google', linked: linkUserId !== undefined },
        'signed in'
      )

      return oauthSuccessRedirect(event, 'google')
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        if (error.statusCode === 409) return loginError(event, 'already_linked')
        if (error.statusCode === 403) return loginError(event, 'registration_closed')
      }
      // DB write (account link) or session persistence failed — the
      // user passed Google auth but we couldn't complete login.
      logger.error(
        { err: error, route: '/api/auth/google', provider: 'google', providerAccountId, userId: linkUserId },
        'failed to provision user or set session after Google sign-in'
      )
      return loginError(event, 'provider_error')
    }
  },
  // Fires when the OAuth flow itself fails (token exchange, provider-returned error) before onSuccess runs.
  onError(event, error) {
    logOAuthFlowError('google', error)
    return loginError(event, 'provider_error')
  }
})

export default defineEventHandler((event) => {
  // nuxt-auth-utils sends a declined consent (no code) back to Google, so handle the cancel here and return the user.
  if (getQuery(event).error === 'access_denied') return oauthCancelRedirect(event)
  return googleHandler(event)
})
