import { deleteCategory } from '~~/server/utils/workouts/categories'
import { categoryDeleteQuerySchema, idParamSchema } from '~~/server/utils/workouts/input'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  const { moveTo } = parseQuery(event, categoryDeleteQuerySchema)
  await deleteCategory(userId, id.data, moveTo)
  return { ok: true }
})
