import { updateExercise } from '~~/server/utils/workouts/exerciseWrites'
import { exerciseIdParamSchema, exerciseUpdateSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = exerciseIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  const body = await parseBody(event, exerciseUpdateSchema)
  return updateExercise(userId, id.data, body)
})
