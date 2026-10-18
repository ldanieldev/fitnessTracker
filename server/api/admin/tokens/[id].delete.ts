import { revokeToken } from '~~/server/utils/accessTokens/store'
import { requireAdmin } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = routeId(event)
  if (!(await revokeToken(id))) {
    logger.debug({ event: 'admin.token_revoke_missing', adminId: admin.id, tokenId: id }, 'token to revoke not found')
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  logger.info({ event: 'admin.token_revoked', adminId: admin.id, tokenId: id }, 'admin revoked an access token')
  setResponseStatus(event, 204)
  return null
})
