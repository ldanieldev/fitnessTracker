import type { MeasurementGoal } from '~~/shared/types/body'
import { measurementGoals } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { latestReading, toGoal } from '~~/server/utils/body/goals'
import { goalPutSchema } from '~~/server/utils/body/input'
import { loadTypeForUser } from '~~/server/utils/body/types'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<MeasurementGoal> => {
  const userId = await requireUserId(event)
  const typeId = Number(getRouterParam(event, 'id'))
  const body = await parseBody(event, goalPutSchema)
  await loadTypeForUser(userId, typeId)

  const latest = await latestReading(userId, typeId)
  if (!latest) throw createError({ statusCode: 400, statusMessage: 'Log a reading before setting a goal' })

  const values = {
    targetValue: String(body.targetValue),
    targetDate: body.targetDate ?? null,
    startValue: latest.value,
    startDate: latest.measuredOn
  }
  const row = await db
    .insert(measurementGoals)
    .values({ userId, typeId, ...values })
    .onConflictDoUpdate({ target: [measurementGoals.userId, measurementGoals.typeId], set: values })
    .returning()
    .then((r) => r[0]!)

  return toGoal(row)
})
