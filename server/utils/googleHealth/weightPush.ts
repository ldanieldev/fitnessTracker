import { FetchError } from 'ofetch'
import { and, eq } from 'drizzle-orm'
import { googleHealthConnections, measurements } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { inngest } from '~~/server/utils/inngest/client'
import { markReported } from '~~/server/utils/inngest/reported'
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

type PushOutcome = 'pushed' | 'deleted' | 'skipped'

function skip(change: WeightChange, reason: string): PushOutcome {
  const { userId, measurementId } = change
  logger.debug({ userId, measurementId, reason }, 'Google Health weight push skipped')
  return 'skipped'
}

function done(change: WeightChange, outcome: PushOutcome, adopted = false, staleDeleted = 0): PushOutcome {
  logger.info(
    { userId: change.userId, measurementId: change.measurementId, outcome, adopted, staleDeleted },
    'Google Health weight push finished'
  )
  return outcome
}

export async function pushWeight(change: WeightChange): Promise<PushOutcome> {
  const conn = await loadActiveConnection(change.userId)
  const config = googleHealthConfig()
  if (!conn || !config.available) return skip(change, 'not_connected')
  if (!conn.pushWeight || conn.status !== 'active') return skip(change, 'push_off')
  if (!granted(conn.scopes).weightWrite) return skip(change, 'no_write_scope')

  let refreshToken: string
  try {
    refreshToken = decryptToken(conn.refreshTokenEnc, config.tokenKey)
  } catch (err) {
    logger.error({ err: markReported(err), userId: change.userId }, 'Google Health stored token could not be decrypted')
    throw err
  }
  let access: string
  try {
    access = await refreshAccessToken(refreshToken, change.userId)
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      logger.warn({ userId: change.userId }, 'Google Health weight push stopped: access revoked')
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
  if (!change.deleted && !row) return skip(change, 'measurement_gone')
  if (row && change.utcOffsetMinutes === null) {
    logger.warn(
      { userId: change.userId, measurementId: change.measurementId },
      'Google Health weight push skipped: no UTC offset'
    )
    await db
      .update(googleHealthConnections)
      .set({ lastError: `Weigh-in on ${row.measuredOn} not sent to Google: no timezone offset` })
      .where(eq(googleHealthConnections.userId, change.userId))
    return 'skipped'
  }

  // A live row's point id is read now so an edit queued before the push counts; a deleted row only has the event's id.
  const previous = row ? row.externalId : change.previousExternalId
  if (previous) {
    await deleteTolerant(access, [previous])
    if (row) await db.update(measurements).set({ externalId: null }).where(eq(measurements.id, row.id))
  }
  if (!row || change.utcOffsetMinutes === null) return done(change, 'deleted')

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
  return done(change, 'pushed', own.adopt !== null, own.stale.length)
}
