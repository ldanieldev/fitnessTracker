import { eq } from 'drizzle-orm'
import { measurements } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadEntryForUser } from '~~/server/utils/body/entries'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  await loadEntryForUser(userId, id)
  await db.delete(measurements).where(eq(measurements.id, id))
  return { ok: true }
})
