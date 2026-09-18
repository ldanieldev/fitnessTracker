import { softDeleteExercise } from '~~/server/utils/workouts/exercises'
import { exerciseIdParamSchema } from '~~/server/utils/workouts/input'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = exerciseIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  await softDeleteExercise(userId, id.data)
  return { ok: true }
})
