import { deleteRoutineDay } from '~~/server/utils/workouts/routineDays'
import { idParamSchema } from '~~/server/utils/workouts/input'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Routine day not found' })
  return deleteRoutineDay(userId, id.data)
})
