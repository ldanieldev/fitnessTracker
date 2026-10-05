import { patchProgram } from '~~/server/utils/workouts/programs'
import { idParamSchema, programPatchSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Program not found' })
  const body = await parseBody(event, programPatchSchema)
  return patchProgram(userId, id.data, body)
})
