import { measurementTypes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { typeCreateSchema } from '~~/server/utils/body/input'
import { toMeasurementType } from '~~/server/utils/body/types'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { isUniqueViolation } from '~~/server/utils/pgError'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, typeCreateSchema)
  try {
    const row = await db
      .insert(measurementTypes)
      .values({ userId, key: null, name: body.name, unit: body.unit, precision: body.precision, direction: body.direction })
      .returning()
      .then((r) => r[0]!)
    return toMeasurementType(row)
  } catch (err) {
    if (isUniqueViolation(err, 'measurement_type_user_name')) {
      throw createError({ statusCode: 409, statusMessage: 'A measurement with that name already exists' })
    }
    throw err
  }
})
