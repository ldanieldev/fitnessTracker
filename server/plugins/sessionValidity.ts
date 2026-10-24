// nuxt-auth-utils serves /api/_auth/session from the cookie alone; reject revoked sessions so SSR sees them logged out.
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (_session, event) => {
    if ((await validSessionUserId(event)) === undefined) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  })
})
