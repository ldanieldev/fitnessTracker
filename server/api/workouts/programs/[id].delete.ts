import { deleteProgram } from '~~/server/utils/workouts/programs'
import { idParamSchema } from '~~/server/utils/workouts/input'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Program not found' })
  await deleteProgram(userId, id.data)
  return { ok: true }
})
