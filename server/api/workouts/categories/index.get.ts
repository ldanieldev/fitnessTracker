import { listCategoriesForUser } from '~~/server/utils/workouts/categories'
import { categoryListQuerySchema } from '~~/server/utils/workouts/input'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { includeHidden } = parseQuery(event, categoryListQuerySchema)
  return listCategoriesForUser(userId, { includeHidden })
})
