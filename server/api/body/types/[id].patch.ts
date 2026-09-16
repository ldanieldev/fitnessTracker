import { and, eq } from 'drizzle-orm'
import { measurementTypePrefs, measurementTypes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { typePatchSchema } from '~~/server/utils/body/input'
import { loadTypeForUser, toMeasurementType } from '~~/server/utils/body/types'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { isUniqueViolation } from '~~/server/utils/pgError'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await parseBody(event, typePatchSchema)
  const existing = await loadTypeForUser(userId, id)
  if (existing.userId === null) throw createError({ statusCode: 403, statusMessage: 'Built-in measurements cannot be edited' })

  try {
    const row = await db.update(measurementTypes).set(body).where(eq(measurementTypes.id, id)).returning().then((r) => r[0]!)
    const pref = await db
      .select({ hidden: measurementTypePrefs.hidden, sortOrder: measurementTypePrefs.sortOrder })
      .from(measurementTypePrefs)
      .where(and(eq(measurementTypePrefs.userId, userId), eq(measurementTypePrefs.typeId, id)))
      .then((r) => r[0])
    return toMeasurementType(row, pref)
  } catch (err) {
    if (isUniqueViolation(err, 'measurement_type_user_name')) {
      throw createError({ statusCode: 409, statusMessage: 'A measurement with that name already exists' })
    }
    throw err
  }
})
