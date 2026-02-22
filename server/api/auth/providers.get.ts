import { eq } from 'drizzle-orm'
import { authProviders } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const linked = await db
    .select({
      provider: authProviders.provider,
      providerAccountId: authProviders.providerAccountId,
      createdAt: authProviders.createdAt
    })
    .from(authProviders)
    .where(eq(authProviders.userId, session.user.id))

  return linked
})
