import { revokeToken } from '~~/server/utils/accessTokens/store'
import { forbidToken, requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  forbidToken(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  if (!(await revokeToken(id, userId))) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setResponseStatus(event, 204)
  return null
})
