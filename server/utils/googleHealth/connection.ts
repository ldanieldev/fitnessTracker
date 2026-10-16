import { eq } from 'drizzle-orm'
import type { GoogleHealthStatus } from '~~/shared/types/googleHealth'
import { googleHealthConnections } from '~~/server/db/schema'
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
