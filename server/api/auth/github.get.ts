import { fetchGitHubEmails, verifiedPrimaryEmail } from '~~/server/utils/githubEmail'
import { logOAuthFlowError, withoutErrorData } from '~~/server/utils/auth'
import { validSessionUserId, writeSession } from '~~/server/utils/session'
import { toSessionUser } from '~~/server/utils/sessionUser'

const githubHandler = defineOAuthGitHubEventHandler({
  config: {
    scope: ['user:email'],
    emailRequired: true
  },
  async onSuccess(event, { user: ghUser, tokens }) {
    const providerAccountId = String(ghUser.id)
    let email: string | null
    try {
      email = verifiedPrimaryEmail(await fetchGitHubEmails(tokens.access_token))
    } catch (error) {
      logger.error(
        { err: withoutErrorData(error), route: '/api/auth/github', provider: 'github', providerAccountId },
        'GitHub email lookup failed'
      )
      return loginError(event, 'provider_error')
    }
    if (!email) {
      logger.warn(
        { event: 'auth.oauth_email_unverified', provider: 'github', providerAccountId },
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
          name: ghUser.name || ghUser.login || email,
          avatarUrl: ghUser.avatar_url ?? undefined
        },
        {
          provider: 'github',
          providerAccountId
        },
        linkUserId
      )
      if (user.isActive === false) {
        logger.warn(
          { event: 'auth.login_disabled', userId: user.id, method: 'github' },
          'sign-in refused: account disabled'
        )
        return loginError(event, 'account_disabled')
      }

      await writeSession(event, toSessionUser(user), user.sessionEpoch)
      logger.info(
        { event: 'auth.login', userId: user.id, method: 'github', linked: linkUserId !== undefined },
        'signed in'
      )

      return oauthSuccessRedirect(event, 'github')
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        if (error.statusCode === 409) return loginError(event, 'already_linked')
        if (error.statusCode === 403) return loginError(event, 'registration_closed')
      }
      // DB write (account link) or session persistence failed — the
      // user passed GitHub auth but we couldn't complete login.
      logger.error(
        { err: error, route: '/api/auth/github', provider: 'github', providerAccountId, userId: linkUserId },
        'failed to provision user or set session after GitHub sign-in'
      )
      return loginError(event, 'provider_error')
    }
  },
  // Fires when the OAuth flow itself fails (token exchange, provider-returned error) before onSuccess runs.
  onError(event, error) {
    logOAuthFlowError('github', error)
    return loginError(event, 'provider_error')
  }
})

export default defineEventHandler((event) => {
  // nuxt-auth-utils reports a declined consent as a failed sign-in, so handle the cancel here and return quietly.
  if (getQuery(event).error === 'access_denied') return oauthCancelRedirect(event)
  return githubHandler(event)
})
