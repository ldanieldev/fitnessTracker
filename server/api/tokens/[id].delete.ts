import { revokeToken } from '~~/server/utils/accessTokens/store'
import { forbidToken, requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  forbidToken(event)
  const id = routeId(event)
  if (!(await revokeToken(id, userId))) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setResponseStatus(event, 204)
  return null
})
