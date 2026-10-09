import { patchVariationGroup } from '~~/server/utils/workouts/variations'
import { idParamSchema, variationPatchSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Variation group not found' })
  const body = await parseBody(event, variationPatchSchema)
  return patchVariationGroup(userId, id.data, body)
})
