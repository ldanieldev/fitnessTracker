import { revokeToken } from '~~/server/utils/accessTokens/store'
import { forbidToken, requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  forbidToken(event)
  const id = routeId(event)
  if (!(await revokeToken(id, userId))) {
    logger.debug({ event: 'token.revoke_missing', userId, tokenId: id }, 'token to revoke not found')
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  logger.info({ event: 'token.revoked', userId, tokenId: id }, 'access token revoked')
  setResponseStatus(event, 204)
  return null
})
