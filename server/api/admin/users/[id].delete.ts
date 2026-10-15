import { eq } from 'drizzle-orm'
import { users } from '~~/server/db/schema'
import { deleteAccount } from '~~/server/utils/deleteAccount'
import { requireAdmin } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  if (id === admin.id) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot change your own account here' })
  }
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1)
  if (!exists.length) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  await deleteAccount(id)
  setResponseStatus(event, 204)
  return null
})
