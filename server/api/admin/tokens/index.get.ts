import { listAllTokens } from '~~/server/utils/accessTokens/store'
import { requireAdmin } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return (await listAllTokens()).map(({ userId: _owner, ...row }) => row)
})
