const githubHandler = defineOAuthGitHubEventHandler({
  config: {
    scope: ['user:email'],
    emailRequired: true
  },
  async onSuccess(event, { user: ghUser }) {
    const email: string = ghUser.email || ''
    if (!email) {
      return loginError(event, 'no_email')
    }

    try {
      // If a session exists, this is a "link account" flow — attach the provider
      // to the signed-in user.
      const session = await getUserSession(event)
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
        session.user?.id
      )

      await setUserSession(event, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatarUrl,
          age: user.age,
          sex: user.sex
        }
      })

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
