const googleHandler = defineOAuthGoogleEventHandler({
  async onSuccess(event, { user: googleUser }) {
    const email: string = googleUser.email || ''
    if (!email) {
      return loginError(event, 'no_email')
    }

    if (!googleUser.email_verified) {
      return loginError(event, 'email_unverified')
    }

    try {
      // If a session exists, this is a "link account" flow — attach the provider
      // to the signed-in user.
      const session = await getUserSession(event)
      const user = await findOrCreateUserAndLinkProvider(
        {
          email,
          name: googleUser.name || email,
          avatarUrl: googleUser.picture ?? undefined
        },
        {
          provider: 'google',
          providerAccountId: String(googleUser.sub)
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

      return oauthSuccessRedirect(event, 'google')
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409) {
        return loginError(event, 'already_linked')
      }
      // DB write (account link) or session persistence failed — the
      // user passed Google auth but we couldn't complete login.
      logger.error(
        { err: error, route: '/api/auth/google', provider: 'google', providerAccountId: String(googleUser.sub) },
        'failed to provision user or set session after Google sign-in'
      )
      return loginError(event, 'provider_error')
    }
  },
  // Fires when the OAuth flow itself fails (token exchange, provider-returned
  // error, denied consent) before onSuccess runs.
  onError(event, error) {
    logger.error({ err: error, route: '/api/auth/google', provider: 'google' }, 'Google OAuth flow failed')
    return loginError(event, 'provider_error')
  }
})

export default defineEventHandler(googleHandler)
