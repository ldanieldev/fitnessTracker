import { deleteProgramPhase } from '~~/server/utils/workouts/programs'
import { idParamSchema } from '~~/server/utils/validation'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Phase not found' })
  return deleteProgramPhase(userId, id.data)
})
