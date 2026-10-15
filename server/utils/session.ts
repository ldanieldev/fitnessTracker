import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { User } from '#auth-utils'
import { users } from '~~/server/db/schema'
import { parseBearer } from '~~/server/utils/accessTokens/token'
import { resolveToken, touchToken } from '~~/server/utils/accessTokens/store'

async function requireTokenUser(event: H3Event, header: string): Promise<User> {
  if (event.context.tokenUser) return event.context.tokenUser
  const token = parseBearer(header)
  const resolved = token ? await resolveToken(token) : null
  if (!resolved) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid access token' })
  }
  event.context.authVia = 'token'
  event.context.accessTokenId = resolved.tokenId
  event.context.tokenUser = resolved.user
  await touchToken(resolved.tokenId)
  return resolved.user
}

// An Authorization header alone decides (never the cookie); a cookie's user row is re-checked (it can outlive a reset).
export async function requireSessionUser(event: H3Event) {
  const authorization = getRequestHeader(event, 'authorization')
  if (authorization !== undefined) return requireTokenUser(event, authorization)

  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (event.context.sessionUserExists === undefined) {
    const row = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((r) => r[0])
    event.context.sessionUserExists = !!row
  }

  if (!event.context.sessionUserExists) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  event.context.authVia = 'session'
  return session.user
}

export async function requireUserId(event: H3Event): Promise<number> {
  return (await requireSessionUser(event)).id
}

export function isTokenRequest(event: H3Event) {
  return event.context.authVia === 'token' || getRequestHeader(event, 'authorization') !== undefined
}

export function forbidToken(event: H3Event) {
  if (isTokenRequest(event)) {
    throw createError({ statusCode: 403, statusMessage: 'Not allowed with an access token' })
  }
}
