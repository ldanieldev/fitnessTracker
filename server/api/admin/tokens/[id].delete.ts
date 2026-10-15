import { revokeToken } from '~~/server/utils/accessTokens/store'
import { requireAdmin } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  if (!(await revokeToken(id))) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setResponseStatus(event, 204)
  return null
})
