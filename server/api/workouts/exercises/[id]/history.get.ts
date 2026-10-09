import type { ExerciseHistorySession } from '~~/shared/types/workout'
import { exerciseIdParamSchema, workoutHistoryQuerySchema } from '~~/server/utils/workouts/input'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { exerciseHistory } from '~~/server/utils/workouts/progress'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<ExerciseHistorySession[]> => {
  const userId = await requireUserId(event)
  const id = exerciseIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  return exerciseHistory(userId, id.data, parseQuery(event, workoutHistoryQuerySchema).limit)
})
