export default defineOAuthGitHubEventHandler({
  config: {
    scope: ['user:email'],
    emailRequired: true
  },
  async onSuccess(event, { user: ghUser }) {
    const email: string = ghUser.email || ''
    if (!email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'GitHub account has no public email. Please make your email public or use another login method.'
      })
    }

    const user = await findOrCreateUserAndLinkProvider(
      {
        email,
        name: ghUser.name || ghUser.login || email,
        avatarUrl: ghUser.avatar_url ?? undefined
      },
      {
        provider: 'github',
        providerAccountId: String(ghUser.id)
      }
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

    return sendRedirect(event, '/')
  }
})
