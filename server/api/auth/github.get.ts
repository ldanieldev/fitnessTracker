import { fetchGitHubEmails, verifiedPrimaryEmail } from '~~/server/utils/githubEmail'
import { validSessionUserId, writeSession } from '~~/server/utils/session'
import { toSessionUser } from '~~/server/utils/sessionUser'

const githubHandler = defineOAuthGitHubEventHandler({
  config: {
    scope: ['user:email'],
    emailRequired: true
  },
  async onSuccess(event, { user: ghUser, tokens }) {
    let email: string | null
    try {
      email = verifiedPrimaryEmail(await fetchGitHubEmails(tokens.access_token))
    } catch (error) {
      logger.error({ err: error, route: '/api/auth/github', provider: 'github' }, 'GitHub email lookup failed')
      return loginError(event, 'provider_error')
    }
    if (!email) {
      return loginError(event, 'email_unverified')
    }

    try {
      // Only a still-valid session links; a revoked cookie must not attach this provider to its user.
      const linkUserId = await validSessionUserId(event)
      const user = await findOrCreateUserAndLinkProvider(
        {
          email,
          name: ghUser.name || ghUser.login || email,
          avatarUrl: ghUser.avatar_url ?? undefined
        },
        {
          provider: 'github',
          providerAccountId: String(ghUser.id)
        },
        linkUserId
      )
      if (user.isActive === false) return loginError(event, 'account_disabled')

      await writeSession(event, toSessionUser(user), user.sessionEpoch)

      return oauthSuccessRedirect(event, 'github')
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409) {
        return loginError(event, 'already_linked')
      }
      // DB write (account link) or session persistence failed — the
      // user passed GitHub auth but we couldn't complete login.
      logger.error(
        { err: error, route: '/api/auth/github', provider: 'github', providerAccountId: String(ghUser.id) },
        'failed to provision user or set session after GitHub sign-in'
      )
      return loginError(event, 'provider_error')
    }
  },
  // Fires when the OAuth flow itself fails (token exchange, provider-returned
  // error, denied consent) before onSuccess runs.
  onError(event, error) {
    logger.error({ err: error, route: '/api/auth/github', provider: 'github' }, 'GitHub OAuth flow failed')
    return loginError(event, 'provider_error')
  }
})

export default defineEventHandler(githubHandler)
