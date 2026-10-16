import { and, eq, isNull } from 'drizzle-orm'
import { users } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { forbidToken, requireSessionUser, writeSession } from '~~/server/utils/session'
import { toSessionUser } from '~~/server/utils/sessionUser'
import { publicUserColumns } from '~~/server/utils/userColumns'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  forbidToken(event)

  await db
    .update(users)
    .set({ onboardedAt: new Date() })
    .where(and(eq(users.id, sessionUser.id), isNull(users.onboardedAt)))
  const user = await db
    .select(publicUserColumns)
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .then((r) => r[0]!)

  const epoch = (await getUserSession(event)).secure?.epoch ?? 0
  await writeSession(event, toSessionUser(user), epoch)
  setResponseStatus(event, 204)
  return null
})
