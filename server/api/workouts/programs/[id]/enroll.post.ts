import { enrollProgram } from '~~/server/utils/workouts/enrollments'
import { enrollSchema, idParamSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Program not found' })
  const body = await parseBody(event, enrollSchema)
  return enrollProgram(userId, id.data, body)
})
