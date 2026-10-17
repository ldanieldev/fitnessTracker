import { eq } from 'drizzle-orm'
import { users } from '~~/server/db/schema'
import { requireUserId } from '~~/server/utils/session'
import { publicUserColumns } from '~~/server/utils/userColumns'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const sessionUserId = await requireUserId(event)
  const id = routeId(event)

  if (id !== sessionUserId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const result = await withQuerySpan('select-user', () =>
    db.select(publicUserColumns).from(users).where(eq(users.id, id)).limit(1)
  )

  const user = result?.[0]

  logger.debug({ route: '/api/users/[id]', id, user }, 'user fetched')

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  }

  return user
})
