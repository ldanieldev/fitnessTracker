import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '~~/server/db/schema'
import { normalizeEmail } from '~~/shared/utils/email'
import { deleteAccount } from '~~/server/utils/deleteAccount'
import { disconnectGoogleHealth } from '~~/server/utils/googleHealth/disconnect'
import { forbidToken, requireSessionUser } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  forbidToken(event)

  const id = routeId(event)

  if (sessionUser.id !== id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (event.context.sessionIsAdmin) {
    throw createError({ statusCode: 400, statusMessage: 'Move the admin role to another account first' })
  }

  const confirm = z.object({ confirmEmail: z.string() }).safeParse(await readBody(event))
  const row = await db.select({ email: users.email }).from(users).where(eq(users.id, id)).limit(1)
  if (!confirm.success || normalizeEmail(confirm.data.confirmEmail) !== row[0]?.email) {
    throw createError({ statusCode: 400, statusMessage: 'Type your account email to confirm' })
  }

  await disconnectGoogleHealth(id)
  await deleteAccount(id)
  await clearUserSession(event)

  return { success: true }
})
