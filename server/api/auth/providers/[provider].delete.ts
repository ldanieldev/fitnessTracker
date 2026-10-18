import { and, eq } from 'drizzle-orm'
import { authProviders, users } from '~~/server/db/schema'
import { forbidToken, requireSessionUser } from '~~/server/utils/session'
import { leavesNoSignIn } from '~~/server/utils/unlinkProvider'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  forbidToken(event)

  const provider = getRouterParam(event, 'provider')
  if (!provider || !['credentials', 'github', 'google'].includes(provider)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid provider' })
  }

  const removed = await db.transaction(async (tx) => {
    // FOR UPDATE serialises concurrent unlinks, so two of them can't each leave the other as the last method.
    const linked = await tx
      .select({ provider: authProviders.provider })
      .from(authProviders)
      .where(eq(authProviders.userId, sessionUser.id))
      .for('update')

    if (leavesNoSignIn(linked.map((row) => row.provider), provider)) {
      logger.debug({ event: 'auth.unlink_refused', userId: sessionUser.id, provider }, 'unlink refused: only method')
      throw createError({ statusCode: 400, statusMessage: 'Cannot unlink your only authentication method' })
    }

    const rows = await tx
      .delete(authProviders)
      .where(and(eq(authProviders.userId, sessionUser.id), eq(authProviders.provider, provider)))
      .returning({ id: authProviders.id })
    if (provider === 'credentials') await tx.update(users).set({ password: null }).where(eq(users.id, sessionUser.id))
    return rows.length > 0
  })
  if (removed) logger.info({ event: 'auth.provider_unlinked', userId: sessionUser.id, provider }, 'provider unlinked')

  return { success: true }
})
