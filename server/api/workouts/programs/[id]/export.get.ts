import { exportProgram } from '~~/server/utils/workouts/programTransfer'
import { idParamSchema } from '~~/server/utils/workouts/input'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Program not found' })
  const { filename, body } = await exportProgram(userId, id.data)
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  return body
})
