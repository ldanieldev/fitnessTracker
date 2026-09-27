import type { ExerciseRecords } from '~~/shared/types/workout'
import { exerciseIdParamSchema } from '~~/server/utils/workouts/input'
import { exerciseRecords } from '~~/server/utils/workouts/progress'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<ExerciseRecords> => {
  const userId = await requireUserId(event)
  const id = exerciseIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  return exerciseRecords(userId, id.data)
})
