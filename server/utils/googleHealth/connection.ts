import { and, eq, sql } from 'drizzle-orm'
import type { GoogleHealthStatus } from '~~/shared/types/googleHealth'
import { googleHealthConnections, users } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { googleHealthConfig } from './config'
import { SCOPE } from './scopes'

export type ConnectionRow = typeof googleHealthConnections.$inferSelect

export async function loadConnection(userId: number): Promise<ConnectionRow | null> {
  return db
    .select()
    .from(googleHealthConnections)
    .where(eq(googleHealthConnections.userId, userId))
    .then((r) => r[0] ?? null)
}

export const ACTIVE_USER = sql`${users.isActive} is not false`

export async function loadActiveConnection(userId: number): Promise<ConnectionRow | null> {
  return db
    .select({ connection: googleHealthConnections })
    .from(googleHealthConnections)
    .innerJoin(users, and(eq(users.id, googleHealthConnections.userId), ACTIVE_USER))
    .where(eq(googleHealthConnections.userId, userId))
    .then((r) => r[0]?.connection ?? null)
}

export function connectValues(
  previous: Pick<ConnectionRow, 'googleSub'> | null,
  grant: { googleSub: string; googleEmail: string; refreshTokenEnc: string; scopes: string[] }
) {
  // syncStartedAt stays as is: clearing it would let a second sync start while one is still running.
  const values = { ...grant, status: 'active' as const, lastError: null }
  // The opt-ins were given for the previous Google account, so a different one starts with both off.
  if (previous && previous.googleSub !== grant.googleSub) return { ...values, syncSteps: false, pushWeight: false }
  return values
}

export function syncCooldownSeconds(
  conn: Pick<ConnectionRow, 'lastSyncedAt' | 'syncStartedAt'>,
  now: number,
  cooldownSeconds: number
): number {
  const latest = Math.max(conn.lastSyncedAt?.getTime() ?? 0, conn.syncStartedAt?.getTime() ?? 0)
  return Math.max(0, Math.ceil((latest + cooldownSeconds * 1000 - now) / 1000))
}

export function granted(scopes: string[]) {
  return {
    sleep: scopes.includes(SCOPE.sleepRead),
    metrics: scopes.includes(SCOPE.metricsRead),
    activity: scopes.includes(SCOPE.activityRead),
    weightWrite: scopes.includes(SCOPE.metricsWrite)
  }
}

export async function connectionStatus(userId: number): Promise<GoogleHealthStatus> {
  const available = googleHealthConfig().available
  const row = available ? await loadConnection(userId) : null
  return {
    available,
    connection: row && {
      email: row.googleEmail,
      status: row.status,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      lastError: row.lastError,
      syncSteps: row.syncSteps,
      pushWeight: row.pushWeight,
      granted: granted(row.scopes)
    }
  }
}

export async function markReconnect(userId: number, message: string): Promise<void> {
  await db
    .update(googleHealthConnections)
    .set({ status: 'reconnect_required', lastError: message, syncStartedAt: null })
    .where(eq(googleHealthConnections.userId, userId))
}
