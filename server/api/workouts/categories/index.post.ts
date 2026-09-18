import { createCategory } from '~~/server/utils/workouts/categories'
import { categoryCreateSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, categoryCreateSchema)
  return createCategory(userId, body)
})
