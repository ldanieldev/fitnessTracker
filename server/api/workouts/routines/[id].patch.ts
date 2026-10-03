import { patchRoutine } from '~~/server/utils/workouts/routines'
import { idParamSchema, routinePatchSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Routine not found' })
  const body = await parseBody(event, routinePatchSchema)
  return patchRoutine(userId, id.data, body)
})
