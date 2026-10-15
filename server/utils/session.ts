import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { User } from '#auth-utils'
import { users } from '~~/server/db/schema'
import { parseBearer } from '~~/server/utils/accessTokens/token'
import { sessionRejected } from '~~/server/utils/sessionEpoch'
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

// An Authorization header alone decides (never the cookie); a cookie is checked against the row's epoch and isActive.
export async function requireSessionUser(event: H3Event) {
  const authorization = getRequestHeader(event, 'authorization')
  if (authorization !== undefined) return requireTokenUser(event, authorization)

  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (event.context.sessionUserValid === undefined) {
    const row = await db
      .select({ isActive: users.isActive, sessionEpoch: users.sessionEpoch, isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((r) => r[0])
    event.context.sessionUserValid = !sessionRejected(row, session.secure?.epoch)
    event.context.sessionIsAdmin = row?.isAdmin === true
  }

  if (!event.context.sessionUserValid) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  event.context.authVia = 'session'
  return session.user
}

export async function validSessionUserId(event: H3Event): Promise<number | undefined> {
  const session = await getUserSession(event)
  if (!session.user) return undefined
  const row = await db
    .select({ isActive: users.isActive, sessionEpoch: users.sessionEpoch })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((r) => r[0])
  if (!sessionRejected(row, session.secure?.epoch)) return session.user.id
  await clearUserSession(event)
  return undefined
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

export async function requireAdmin(event: H3Event) {
  forbidToken(event)
  const user = await requireSessionUser(event)
  if (!event.context.sessionIsAdmin) throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  return user
}

export async function writeSession(event: H3Event, user: User, epoch: number) {
  await replaceUserSession(event, { user, secure: { epoch } })
}
