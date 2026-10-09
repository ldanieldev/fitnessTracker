import { asc, eq } from 'drizzle-orm'
import { userProgramEnrollments } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const userId = await requireUserId(event)
  return db
    .select({ programId: userProgramEnrollments.programId, status: userProgramEnrollments.status })
    .from(userProgramEnrollments)
    .where(eq(userProgramEnrollments.userId, userId))
    .orderBy(asc(userProgramEnrollments.id))
})
