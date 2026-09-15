import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { users } from '~~/server/db/schema'

/** Verifies the session's user row still exists (a stale cookie can outlive a DB reset); cached per-request. */
export async function requireSessionUser(event: H3Event) {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (event.context.sessionUserExists === undefined) {
    const row = await db.select({ id: users.id }).from(users).where(eq(users.id, session.user.id)).limit(1).then((r) => r[0])
    event.context.sessionUserExists = !!row
  }

  if (!event.context.sessionUserExists) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return session.user
}

export async function requireUserId(event: H3Event): Promise<number> {
  return (await requireSessionUser(event)).id
}
