import { eq } from 'drizzle-orm'
import { users } from '~~/server/db/schema'
import { requireUserId } from '~~/server/utils/session'
import { publicUserColumns } from '~~/server/utils/userColumns'
import { requestRoute } from '~~/server/utils/requestLog'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const sessionUserId = await requireUserId(event)
  const id = routeId(event)

  if (id !== sessionUserId) {
    logger.warn(
      { event: 'forbidden_other_user', userId: sessionUserId, targetId: id, route: requestRoute(event) },
      'request for another user\'s account refused'
    )
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const result = await withQuerySpan('select-user', () =>
    db.select(publicUserColumns).from(users).where(eq(users.id, id)).limit(1)
  )

  const user = result?.[0]

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  }

  logger.debug({ route: '/api/users/[id]', id }, 'user fetched')

  return user
})
