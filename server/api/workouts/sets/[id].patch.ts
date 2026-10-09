import { patchSet } from '~~/server/utils/workouts/sets'
import { idParamSchema, setWriteSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Set not found' })
  const body = await parseBody(event, setWriteSchema)
  return patchSet(userId, id.data, body)
})
