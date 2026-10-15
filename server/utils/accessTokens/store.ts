import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import type { User } from '#auth-utils'
import { accessTokens, users } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { toSessionUser } from '~~/server/utils/sessionUser'
import { publicUserColumns } from '~~/server/utils/userColumns'
import { generateToken, hashToken } from './token'

export interface AccessTokenRow {
  id: number
  userId: number
  name: string
  prefix: string
  createdAt: Date
  lastUsedAt: Date | null
}

const rowColumns = {
  id: accessTokens.id,
  userId: accessTokens.userId,
  name: accessTokens.name,
  prefix: accessTokens.prefix,
  createdAt: accessTokens.createdAt,
  lastUsedAt: accessTokens.lastUsedAt
}

export async function resolveToken(token: string): Promise<{ tokenId: number; user: User } | null> {
  const row = await db
    .select({ tokenId: accessTokens.id, user: publicUserColumns })
    .from(accessTokens)
    .innerJoin(users, and(eq(users.id, accessTokens.userId), sql`${users.isActive} is not false`))
    .where(eq(accessTokens.tokenHash, hashToken(token)))
    .limit(1)
    .then((r) => r[0])
  return row ? { tokenId: row.tokenId, user: toSessionUser(row.user) } : null
}

export async function touchToken(id: number) {
  await db
    .update(accessTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(
      and(
        eq(accessTokens.id, id),
        or(isNull(accessTokens.lastUsedAt), lt(accessTokens.lastUsedAt, sql`now() - interval '60 seconds'`))
      )
    )
}

export async function createToken(userId: number, name: string) {
  const { token, hash, prefix } = generateToken()
  const row = await db
    .insert(accessTokens)
    .values({ userId, name, tokenHash: hash, prefix })
    .onConflictDoNothing({ target: [accessTokens.userId, accessTokens.name] })
    .returning(rowColumns)
    .then((r) => r[0])
  if (!row) throw createError({ statusCode: 409, statusMessage: 'Token name already used' })
  return { token, row }
}

export function listTokens(userId?: number): Promise<AccessTokenRow[]> {
  return db
    .select(rowColumns)
    .from(accessTokens)
    .where(userId === undefined ? undefined : eq(accessTokens.userId, userId))
    .orderBy(desc(accessTokens.createdAt), desc(accessTokens.id))
}

export function listAllTokens(): Promise<Array<AccessTokenRow & { ownerEmail: string }>> {
  return db
    .select({ ...rowColumns, ownerEmail: users.email })
    .from(accessTokens)
    .innerJoin(users, eq(users.id, accessTokens.userId))
    .orderBy(desc(accessTokens.createdAt), desc(accessTokens.id))
}

export async function revokeToken(id: number, userId?: number) {
  const deleted = await db
    .delete(accessTokens)
    .where(and(eq(accessTokens.id, id), userId === undefined ? undefined : eq(accessTokens.userId, userId)))
    .returning({ id: accessTokens.id })
  return deleted.length > 0
}
