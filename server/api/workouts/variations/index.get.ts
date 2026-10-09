import { listVariationGroups } from '~~/server/utils/workouts/variations'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return listVariationGroups(userId)
})
