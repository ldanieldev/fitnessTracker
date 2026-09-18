import { deleteVariationGroup } from '~~/server/utils/workouts/variations'
import { idParamSchema } from '~~/server/utils/workouts/input'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Variation group not found' })
  return deleteVariationGroup(userId, id.data)
})
