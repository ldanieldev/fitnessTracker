import { and, count, eq, max, sql } from 'drizzle-orm'
import { accessTokens, authProviders, users } from '../../db/schema'
import type { DbClient, RootDbClient } from '../db'
import { nextEpoch } from '../sessionEpoch'

export interface AdminUserRow {
  id: number
  name: string
  email: string
  createdAt: Date
  isActive: boolean
  isAdmin: boolean
  providers: string[]
  tokenCount: number
  tokenLastUsedAt: Date | null
}

export async function findUserIdByEmail(client: DbClient, email: string): Promise<number | null> {
  const row = await client
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((r) => r[0])
  return row?.id ?? null
}

export async function currentAdminId(client: DbClient): Promise<number | null> {
  const row = await client
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true))
    .limit(1)
    .then((r) => r[0])
  return row?.id ?? null
}

// Clear before set: users_one_admin rejects any moment with two admins, even inside the transaction.
export async function transferAdmin(client: RootDbClient, userId: number, opts: { bumpEpochs: boolean }) {
  return client.transaction(async (tx) => {
    const previousAdminId = await currentAdminId(tx)
    if (previousAdminId === userId) return { previousAdminId, changed: false }
    const bump = opts.bumpEpochs ? { sessionEpoch: nextEpoch } : {}
    await tx.update(users).set({ isAdmin: false, ...bump }).where(eq(users.isAdmin, true))
    await tx.update(users).set({ isAdmin: true, ...bump }).where(eq(users.id, userId))
    return { previousAdminId, changed: true }
  })
}

export async function clearAdmin(client: DbClient) {
  await client.update(users).set({ isAdmin: false }).where(eq(users.isAdmin, true))
}

export async function overwritePassword(client: RootDbClient, userId: number, hash: string) {
  await client.transaction(async (tx) => {
    const user = await tx
      .update(users)
      .set({ password: hash, sessionEpoch: nextEpoch })
      .where(eq(users.id, userId))
      .returning({ email: users.email })
      .then((r) => r[0])
    if (!user) throw new Error(`No user ${userId}`)
    const credentials = await tx
      .select({ id: authProviders.id })
      .from(authProviders)
      .where(and(eq(authProviders.userId, userId), eq(authProviders.provider, 'credentials')))
      .limit(1)
    if (!credentials.length) {
      await tx.insert(authProviders).values({ userId, provider: 'credentials', providerAccountId: user.email })
    }
    await tx.delete(accessTokens).where(eq(accessTokens.userId, userId))
  })
}

export async function setUserActive(client: RootDbClient, userId: number, active: boolean): Promise<boolean> {
  return client.transaction(async (tx) => {
    const set = active ? { isActive: true } : { isActive: false, sessionEpoch: nextEpoch }
    const rows = await tx.update(users).set(set).where(eq(users.id, userId)).returning({ id: users.id })
    if (!rows.length) return false
    if (!active) await tx.delete(accessTokens).where(eq(accessTokens.userId, userId))
    return true
  })
}

export async function listAdminUsers(client: DbClient): Promise<AdminUserRow[]> {
  const providers = client
    .select({
      userId: authProviders.userId,
      list: sql<string[]>`array_agg(${authProviders.provider} order by ${authProviders.provider})`.as('list')
    })
    .from(authProviders)
    .groupBy(authProviders.userId)
    .as('p')
  const tokens = client
    .select({
      userId: accessTokens.userId,
      total: count().as('total'),
      lastUsed: max(accessTokens.lastUsedAt).as('last_used')
    })
    .from(accessTokens)
    .groupBy(accessTokens.userId)
    .as('t')
  const rows = await client
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      isActive: users.isActive,
      isAdmin: users.isAdmin,
      providers: providers.list,
      tokenCount: tokens.total,
      tokenLastUsedAt: tokens.lastUsed
    })
    .from(users)
    .leftJoin(providers, eq(providers.userId, users.id))
    .leftJoin(tokens, eq(tokens.userId, users.id))
    .orderBy(users.id)
  return rows.map((row) => ({
    ...row,
    isActive: row.isActive !== false,
    providers: row.providers ?? [],
    tokenCount: Number(row.tokenCount ?? 0),
    tokenLastUsedAt: row.tokenLastUsedAt ? new Date(row.tokenLastUsedAt) : null
  }))
}
