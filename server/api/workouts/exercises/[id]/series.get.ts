import type { ExerciseSeries } from '~~/shared/types/workout'
import { exerciseIdParamSchema, workoutSeriesQuerySchema } from '~~/server/utils/workouts/input'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { exerciseSeries } from '~~/server/utils/workouts/progress'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<ExerciseSeries> => {
  const userId = await requireUserId(event)
  const id = exerciseIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  return exerciseSeries(userId, id.data, parseQuery(event, workoutSeriesQuerySchema))
})
