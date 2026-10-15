import { eq } from 'drizzle-orm'
import { authProviders } from '~~/server/db/schema'
import { forbidToken, requireSessionUser } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  forbidToken(event)

  const linked = await db
    .select({
      provider: authProviders.provider,
      providerAccountId: authProviders.providerAccountId,
      createdAt: authProviders.createdAt
    })
    .from(authProviders)
    .where(eq(authProviders.userId, user.id))

  return linked
})
