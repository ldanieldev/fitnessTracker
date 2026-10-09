import { oneRepMaxFor } from '~~/server/utils/workouts/oneRepMax'
import { exerciseIdParamSchema, workoutToolsOneRepMaxQuerySchema } from '~~/server/utils/workouts/input'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = exerciseIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  const query = workoutToolsOneRepMaxQuerySchema.safeParse(getQuery(event))
  if (!query.success) throw createError({ statusCode: 400, statusMessage: 'Invalid date' })
  return oneRepMaxFor(userId, id.data, query.data.on)
})
