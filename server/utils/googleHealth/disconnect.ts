import { eq } from 'drizzle-orm'
import { googleHealthConnections } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { logger } from '~~/server/utils/logger'
import { revokeGoogleToken } from './api'
import { googleHealthConfig } from './config'
import { type ConnectionRow, loadConnection } from './connection'
import { decryptToken } from './crypto'

export async function revokeStoredGrant(conn: ConnectionRow): Promise<void> {
  try {
    await revokeGoogleToken(decryptToken(conn.refreshTokenEnc, googleHealthConfig().tokenKey))
  } catch (error) {
    logger.warn({ err: error, userId: conn.userId }, 'Google Health revoke failed')
  }
}

export async function disconnectGoogleHealth(userId: number): Promise<void> {
  const conn = await loadConnection(userId)
  if (!conn) return
  await revokeStoredGrant(conn)
  await db.delete(googleHealthConnections).where(eq(googleHealthConnections.userId, userId))
}
