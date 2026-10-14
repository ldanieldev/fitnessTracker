import { z } from 'zod'
import { isoDate } from '~~/server/utils/body/input'
import { parseWith } from '~~/server/utils/nutrition/parseBody'
import { skipRoutineDay } from '~~/server/utils/workouts/routines'
import { idParamSchema } from '~~/server/utils/workouts/input'
import { requireUserId } from '~~/server/utils/session'
import { todayDate } from '~~/shared/utils/nutritionSummary'

const skipBodySchema = z.object({ date: isoDate.optional() }).default({})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Routine not found' })
  const { date } = parseWith(skipBodySchema, (await readBody(event).catch(() => undefined)) ?? {})
  return skipRoutineDay(userId, id.data, date ?? todayDate())
})
