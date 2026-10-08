import { createVariationGroup } from '~~/server/utils/workouts/variations'
import { variationCreateSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, variationCreateSchema)
  return createVariationGroup(userId, body)
})
