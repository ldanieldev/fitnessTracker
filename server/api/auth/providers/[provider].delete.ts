import { and, eq } from 'drizzle-orm'
import { authProviders } from '~~/server/db/schema'
import { requireSessionUser } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)

  const provider = getRouterParam(event, 'provider')
  if (!provider || !['credentials', 'github', 'google'].includes(provider)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid provider' })
  }

  // Count linked providers — must keep at least one
  const allProviders = await db
    .select({ provider: authProviders.provider })
    .from(authProviders)
    .where(eq(authProviders.userId, sessionUser.id))

  if (allProviders.length <= 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot unlink your only authentication method'
    })
  }

  await db
    .delete(authProviders)
    .where(
      and(
        eq(authProviders.userId, sessionUser.id),
        eq(authProviders.provider, provider)
      )
    )

  return { success: true }
})
