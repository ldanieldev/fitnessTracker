import type { WorkoutGoal } from '~~/shared/types/workout'
import { putGoal } from '~~/server/utils/workouts/goals'
import { exerciseIdParamSchema, workoutGoalPutSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<WorkoutGoal> => {
  const userId = await requireUserId(event)
  const id = exerciseIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  return putGoal(userId, id.data, await parseBody(event, workoutGoalPutSchema))
})
