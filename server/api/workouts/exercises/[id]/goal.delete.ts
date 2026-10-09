import { removeGoal } from '~~/server/utils/workouts/goals'
import { exerciseIdParamSchema, workoutMetricQuerySchema } from '~~/server/utils/workouts/input'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = exerciseIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  await removeGoal(userId, id.data, parseQuery(event, workoutMetricQuerySchema).metric)
  return { ok: true }
})
