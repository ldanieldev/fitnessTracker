import { patchProgramPhase } from '~~/server/utils/workouts/programs'
import { idParamSchema, programPhasePatchSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Phase not found' })
  const body = await parseBody(event, programPhasePatchSchema)
  return patchProgramPhase(userId, id.data, body)
})
