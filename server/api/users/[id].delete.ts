import { eq } from 'drizzle-orm'
import { users } from '~~/server/db/schema'
import { requireSessionUser } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)

  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id) || id === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })
  }

  if (sessionUser.id !== id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  await db.delete(users).where(eq(users.id, id))
  await clearUserSession(event)

  return { success: true }
})
