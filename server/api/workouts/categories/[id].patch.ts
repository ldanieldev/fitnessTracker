import { patchCategory } from '~~/server/utils/workouts/categories'
import { categoryPatchSchema, idParamSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  const body = await parseBody(event, categoryPatchSchema)
  return patchCategory(userId, id.data, body)
})
