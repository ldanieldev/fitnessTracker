import { eq } from 'drizzle-orm'
import { users } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const userId = await requireUserId(event)

  await db.delete(users).where(eq(users.id, userId))

  return { success: true }
})
