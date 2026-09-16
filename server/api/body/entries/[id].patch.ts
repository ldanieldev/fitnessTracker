import { eq } from 'drizzle-orm'
import { measurements } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadEntryForUser, toEntry } from '~~/server/utils/body/entries'
import { entryPatchSchema } from '~~/server/utils/body/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await parseBody(event, entryPatchSchema)
  await loadEntryForUser(userId, id)

  const row = await db
    .update(measurements)
    .set({
      ...(body.value !== undefined ? { value: String(body.value) } : {}),
      ...(body.measuredAt !== undefined ? { measuredAt: body.measuredAt } : {}),
      ...(body.measuredOn !== undefined ? { measuredOn: body.measuredOn } : {})
    })
    .where(eq(measurements.id, id))
    .returning()
    .then((r) => r[0]!)

  return toEntry(row)
})
