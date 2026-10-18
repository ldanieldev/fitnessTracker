import { z } from 'zod'
import { createToken } from '~~/server/utils/accessTokens/store'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { forbidToken, requireUserId } from '~~/server/utils/session'

const createTokenSchema = z.object({ name: z.string().trim().min(1).max(60) })

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  forbidToken(event)
  const { name } = await parseBody(event, createTokenSchema)
  const { token, row } = await createToken(userId, name)
  logger.info({ event: 'token.created', userId, tokenId: row.id }, 'access token created')
  const { userId: _owner, ...rest } = row
  setResponseStatus(event, 201)
  return { token, row: rest }
})
