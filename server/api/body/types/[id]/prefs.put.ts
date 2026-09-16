import { sql } from 'drizzle-orm'
import { measurementTypePrefs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { prefsPutSchema } from '~~/server/utils/body/input'
import { loadTypeForUser, toMeasurementType } from '~~/server/utils/body/types'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const typeId = Number(getRouterParam(event, 'id'))
  const body = await parseBody(event, prefsPutSchema)
  const type = await loadTypeForUser(userId, typeId)

  const pref = await db
    .insert(measurementTypePrefs)
    .values({ userId, typeId, hidden: body.hidden ?? false, sortOrder: body.sortOrder ?? null })
    .onConflictDoUpdate({
      target: [measurementTypePrefs.userId, measurementTypePrefs.typeId],
      set: {
        ...(body.hidden !== undefined ? { hidden: body.hidden } : { hidden: sql`${measurementTypePrefs.hidden}` }),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : { sortOrder: sql`${measurementTypePrefs.sortOrder}` })
      }
    })
    .returning()
    .then((r) => r[0]!)

  return toMeasurementType(type, { hidden: pref.hidden, sortOrder: pref.sortOrder })
})
