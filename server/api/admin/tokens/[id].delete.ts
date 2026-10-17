import { revokeToken } from '~~/server/utils/accessTokens/store'
import { requireAdmin } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = routeId(event)
  if (!(await revokeToken(id))) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setResponseStatus(event, 204)
  return null
})
