import { patchRoutineDay } from '~~/server/utils/workouts/routineDays'
import { idParamSchema, routineDayPatchSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Routine day not found' })
  const body = await parseBody(event, routineDayPatchSchema)
  return patchRoutineDay(userId, id.data, body)
})
