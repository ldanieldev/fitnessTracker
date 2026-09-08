import { eq, getTableColumns } from 'drizzle-orm'
import { users } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  const { password, ...userColumns } = getTableColumns(users)

  if (Number.isNaN(id) || id === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })
  }

  const result = await withQuerySpan('select-user', () =>
    db.select(userColumns).from(users).where(eq(users.id, id)).limit(1)
  )

  const user = result?.[0]

  logger.debug({ route: '/api/users/[id]', id, user }, 'user fetched')

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  }

  return user
})
