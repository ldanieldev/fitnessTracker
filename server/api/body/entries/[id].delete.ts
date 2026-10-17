import { eq } from 'drizzle-orm'
import { measurements } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadEntryForUser } from '~~/server/utils/body/entries'
import { loadTypeForUser } from '~~/server/utils/body/types'
import { queueWeightPush } from '~~/server/utils/googleHealth/weightPush'
import { requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = routeId(event)
  const before = await loadEntryForUser(userId, id)
  await db.delete(measurements).where(eq(measurements.id, id))
  if (before.externalId) {
    const type = await loadTypeForUser(userId, before.typeId)
    await queueWeightPush(
      { userId, measurementId: id, utcOffsetMinutes: null, previousExternalId: before.externalId, deleted: true },
      type.key
    )
  }
  return { ok: true }
})
