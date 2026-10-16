import { FetchError } from 'ofetch'
import { and, eq } from 'drizzle-orm'
import { googleHealthConnections, measurements } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { inngest } from '~~/server/utils/inngest/client'
import { logger } from '~~/server/utils/logger'
import { createWeight, deleteWeights, GoogleAuthError, listWeightsAt, refreshAccessToken } from './api'
import { googleHealthConfig } from './config'
import { granted, loadActiveConnection, loadConnection, markReconnect } from './connection'
import { decryptToken } from './crypto'
import { lbsToGrams, pickOwnPoint } from './map'

export interface WeightChange {
  userId: number
  measurementId: number
  utcOffsetMinutes: number | null
  previousExternalId: string | null
  deleted: boolean
}

export async function queueWeightPush(change: WeightChange, typeKey: string | null): Promise<void> {
  if (typeKey !== 'bodyweight') return
  const conn = await loadConnection(change.userId)
  if (!conn?.pushWeight || conn.status !== 'active') return
  try {
    await inngest.send({ name: 'google-health/weight.changed', data: change })
  } catch (error) {
    logger.warn({ err: error, userId: change.userId }, 'Google Health weight push not queued')
  }
}

async function deleteTolerant(access: string, names: string[]): Promise<void> {
  try {
    await deleteWeights(access, names)
  } catch (error) {
    if (!(error instanceof FetchError && error.statusCode === 404)) throw error
  }
}

export async function pushWeight(change: WeightChange): Promise<'pushed' | 'deleted' | 'skipped'> {
  const conn = await loadActiveConnection(change.userId)
  const config = googleHealthConfig()
  if (!conn || !config.available || !conn.pushWeight || conn.status !== 'active') return 'skipped'
  if (!granted(conn.scopes).weightWrite) return 'skipped'

  let access: string
  try {
    access = await refreshAccessToken(decryptToken(conn.refreshTokenEnc, config.tokenKey))
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      await markReconnect(change.userId, 'Google Health needs to be reconnected')
      return 'skipped'
    }
    throw error
  }

  const row = change.deleted
    ? undefined
    : await db
        .select()
        .from(measurements)
        .where(and(eq(measurements.id, change.measurementId), eq(measurements.userId, change.userId)))
        .then((r) => r[0])
  if (!change.deleted && !row) return 'skipped'
  if (row && change.utcOffsetMinutes === null) {
    await db
      .update(googleHealthConnections)
      .set({ lastError: `Weigh-in on ${row.measuredOn} not sent to Google: no timezone offset` })
      .where(eq(googleHealthConnections.userId, change.userId))
    return 'skipped'
  }

  // A live row's own stored id replaces the event's, so a forged event can't name another Google point to delete.
  const previous = row ? (change.previousExternalId && row.externalId) : change.previousExternalId
  if (previous) {
    await deleteTolerant(access, [previous])
    if (row) await db.update(measurements).set({ externalId: null }).where(eq(measurements.id, row.id))
  }
  if (!row || change.utcOffsetMinutes === null) return 'deleted'

  const physicalTime = row.measuredAt.toISOString()
  const grams = lbsToGrams(Number(row.value))
  const own = pickOwnPoint(await listWeightsAt(access, physicalTime), config.clientId, grams)
  if (own.stale.length) {
    await deleteTolerant(access, own.stale)
    if (row.externalId && own.stale.includes(row.externalId)) {
      await db.update(measurements).set({ externalId: null }).where(eq(measurements.id, row.id))
    }
  }
  const name =
    own.adopt ?? (await createWeight(access, { grams, physicalTime, utcOffsetSeconds: change.utcOffsetMinutes * 60 }))
  await db.update(measurements).set({ externalId: name }).where(eq(measurements.id, row.id))
  return 'pushed'
}
