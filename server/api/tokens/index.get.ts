import { listTokens } from '~~/server/utils/accessTokens/store'
import { forbidToken, requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  forbidToken(event)
  return (await listTokens(userId)).map(({ userId: _owner, ...row }) => row)
})
