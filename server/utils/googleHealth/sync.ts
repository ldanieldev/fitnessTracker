import { and, eq, gte, inArray, isNull, lt, notInArray, or, sql } from 'drizzle-orm'
import { FetchError } from 'ofetch'
import type { SyncCounts, SyncResult } from '~~/shared/types/googleHealth'
import { googleHealthConnections, measurements, measurementTypes, sleepSessions, stepDays } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { markReported, wasReported } from '~~/server/utils/inngest/reported'
import { logger } from '~~/server/utils/logger'
import { shiftDate, todayDate } from '~~/shared/utils/nutritionSummary'
import { dailyRollUp, GoogleAuthError, isRetryable, listPoints, refreshAccessToken } from './api'
import { googleHealthConfig } from './config'
import { granted, loadActiveConnection, markReconnect } from './connection'
import { decryptToken } from './crypto'
import {
  type DailyValue,
  mainSleepEnds,
  mapHrv,
  mapRestingHr,
  mapSleepSessions,
  mapSteps,
  type RawHrvPoint,
  type RawRestingHrPoint,
  type RawSleepPoint,
  type SleepSessionRow,
  sleepHours
} from './map'
import { planDaily } from './plan'

const STEPS_CHUNK_DAYS = 90
const STEPS_BACKFILL_DAYS = 365
const CLAIM_TTL = sql`now() - interval '10 minutes'`

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface Fetched {
  sessions?: SleepSessionRow[]
  hrv?: DailyValue[]
  restingHr?: DailyValue[]
  steps?: DailyValue[]
}

async function claim(userId: number): Promise<boolean> {
  const rows = await db
    .update(googleHealthConnections)
    .set({ syncStartedAt: new Date() })
    .where(
      and(
        eq(googleHealthConnections.userId, userId),
        or(isNull(googleHealthConnections.syncStartedAt), lt(googleHealthConnections.syncStartedAt, CLAIM_TTL))
      )
    )
    .returning({ id: googleHealthConnections.id })
  return rows.length > 0
}

function filterSince(field: string, from: string | null, suffix = ''): string | undefined {
  return from ? `${field} >= "${from}${suffix}"` : undefined
}

async function fetchSteps(access: string, from: string, to: string): Promise<DailyValue[]> {
  const out: DailyValue[] = []
  for (let start = from; start < to; start = shiftDate(start, STEPS_CHUNK_DAYS)) {
    const end = shiftDate(start, STEPS_CHUNK_DAYS) < to ? shiftDate(start, STEPS_CHUNK_DAYS) : to
    out.push(...mapSteps(await dailyRollUp(access, 'steps', start, end)))
  }
  return out
}

async function writeMeasurements(
  tx: Tx,
  userId: number,
  key: 'hrv' | 'resting_hr' | 'sleep',
  values: DailyValue[],
  from: string | null,
  ends: Map<string, Date>
): Promise<number> {
  const type = await tx
    .select({ id: measurementTypes.id })
    .from(measurementTypes)
    .where(and(eq(measurementTypes.key, key), isNull(measurementTypes.userId)))
    .then((r) => r[0]!)
  const existing = await tx
    .select({ id: measurements.id, day: measurements.measuredOn, source: measurements.source })
    .from(measurements)
    .where(
      and(
        eq(measurements.userId, userId),
        eq(measurements.typeId, type.id),
        from ? gte(measurements.measuredOn, from) : undefined
      )
    )
  const plan = planDaily(existing, values)
  if (plan.deleteIds.length) {
    await tx
      .delete(measurements)
      .where(and(inArray(measurements.id, plan.deleteIds), eq(measurements.source, 'google')))
  }
  const now = new Date()
  for (const v of plan.upserts) {
    const end = ends.get(v.day)
    await tx
      .insert(measurements)
      .values({
        userId,
        typeId: type.id,
        value: String(v.value),
        measuredAt: end ?? now,
        measuredOn: v.day,
        source: 'google'
      })
      .onConflictDoUpdate({
        target: [measurements.userId, measurements.typeId, measurements.measuredOn],
        targetWhere: sql`source = 'google'`,
        set: { value: String(v.value), ...(end ? { measuredAt: end } : {}), updatedAt: now }
      })
  }
  return plan.upserts.length
}

async function writeSessions(tx: Tx, userId: number, sessions: SleepSessionRow[], from: string | null) {
  const ids = sessions.map((s) => s.googleId)
  await tx
    .delete(sleepSessions)
    .where(
      and(
        eq(sleepSessions.userId, userId),
        from ? gte(sleepSessions.day, from) : undefined,
        ids.length ? notInArray(sleepSessions.googleId, ids) : undefined
      )
    )
  for (const s of sessions) {
    await tx
      .insert(sleepSessions)
      .values({ userId, ...s })
      .onConflictDoUpdate({
        target: [sleepSessions.userId, sleepSessions.googleId],
        set: { ...s, updatedAt: new Date() }
      })
  }
}

async function writeSteps(tx: Tx, userId: number, values: DailyValue[], from: string | null): Promise<number> {
  const existing = await tx
    .select({ id: stepDays.id, day: stepDays.day, source: stepDays.source })
    .from(stepDays)
    .where(and(eq(stepDays.userId, userId), from ? gte(stepDays.day, from) : undefined))
  const plan = planDaily(
    existing.map((r) => ({ ...r, source: r.source === 'google' ? ('google' as const) : ('manual' as const) })),
    values
  )
  if (plan.deleteIds.length) {
    await tx.delete(stepDays).where(and(inArray(stepDays.id, plan.deleteIds), eq(stepDays.source, 'google')))
  }
  for (const v of plan.upserts) {
    await tx
      .insert(stepDays)
      .values({ userId, day: v.day, steps: v.value, source: 'google' })
      .onConflictDoUpdate({
        target: [stepDays.userId, stepDays.day],
        set: { steps: v.value, updatedAt: new Date() },
        // A manual save racing this sync must survive.
        setWhere: sql`${stepDays.source} = 'google'`
      })
  }
  return plan.upserts.length
}

export class RetryableSyncError extends Error {}

export type SyncRun =
  | Exclude<SyncResult, { outcome: 'ok' }>
  | (Extract<SyncResult, { outcome: 'ok' }> & { retryable: boolean })

function skipped<T extends 'not_connected' | 'reconnect_required' | 'busy'>(userId: number, outcome: T) {
  logger.debug({ userId, outcome }, 'Google Health sync not run')
  return { outcome }
}

export async function syncGoogleHealth(userId: number, opts: { full?: boolean } = {}): Promise<SyncRun> {
  const conn = await loadActiveConnection(userId)
  if (!conn || !googleHealthConfig().available) return skipped(userId, 'not_connected')
  if (conn.status === 'reconnect_required') return skipped(userId, 'reconnect_required')
  if (!(await claim(userId))) return skipped(userId, 'busy')

  const full = opts.full === true
  const startedAt = Date.now()
  const errors: string[] = []
  let retryable = false
  try {
    let access: string
    try {
      let refreshToken: string
      try {
        refreshToken = decryptToken(conn.refreshTokenEnc, googleHealthConfig().tokenKey)
      } catch (err) {
        logger.error({ err, userId }, 'Google Health stored token could not be decrypted')
        throw new GoogleAuthError('Stored Google token could not be decrypted')
      }
      access = await refreshAccessToken(refreshToken, userId)
    } catch (error) {
      if (!(error instanceof GoogleAuthError)) throw error
      await markReconnect(userId, 'Google Health needs to be reconnected')
      return skipped(userId, 'reconnect_required')
    }

    const can = granted(conn.scopes)
    const from = opts.full ? null : shiftDate(todayDate(), -7)
    const fetched: Fetched = {}
    let fetchedStepsFrom: string | null = null
    const attempt = async <K extends keyof Fetched>(key: K, label: string, run: () => Promise<Fetched[K]>) => {
      try {
        fetched[key] = await run()
      } catch (error) {
        errors.push(`${label}: ${error instanceof Error ? error.message : 'failed'}`)
        const dataRetryable = isRetryable(error)
        retryable ||= dataRetryable
        const status = error instanceof FetchError ? error.statusCode : undefined
        logger.warn(
          { err: error, userId, dataType: key, status, retryable: dataRetryable },
          'Google Health data type sync failed'
        )
      }
    }

    if (can.sleep) {
      await attempt('sessions', 'Sleep', async () =>
        mapSleepSessions(
          await listPoints<RawSleepPoint>(
            access,
            'sleep',
            filterSince('sleep.interval.civil_end_time', from, 'T00:00:00')
          )
        )
      )
    }
    if (can.metrics) {
      await attempt('hrv', 'HRV', async () =>
        mapHrv(
          await listPoints<RawHrvPoint>(
            access,
            'daily-heart-rate-variability',
            filterSince('daily_heart_rate_variability.date', from)
          )
        )
      )
      await attempt('restingHr', 'Resting HR', async () =>
        mapRestingHr(
          await listPoints<RawRestingHrPoint>(
            access,
            'daily-resting-heart-rate',
            filterSince('daily_resting_heart_rate.date', from)
          )
        )
      )
    }
    if (conn.syncSteps && can.activity) {
      const days = [...(fetched.hrv ?? []), ...(fetched.restingHr ?? []), ...(fetched.sessions ?? [])].map((v) => v.day)
      const floor = shiftDate(todayDate(), -STEPS_BACKFILL_DAYS)
      const earliest = days.length ? days.reduce((a, b) => (a < b ? a : b)) : shiftDate(todayDate(), -7)
      const stepsFrom = from ?? (earliest < floor ? floor : earliest)
      await attempt('steps', 'Steps', async () => {
        const steps = await fetchSteps(access, stepsFrom, shiftDate(todayDate(), 2))
        fetchedStepsFrom = stepsFrom
        return steps
      })
    }

    const counts: SyncCounts = { hrv: 0, restingHr: 0, sleep: 0, steps: 0 }
    await db.transaction(async (tx) => {
      const ends = mainSleepEnds(fetched.sessions ?? [])
      if (fetched.sessions) {
        await writeSessions(tx, userId, fetched.sessions, from)
        counts.sleep = await writeMeasurements(tx, userId, 'sleep', sleepHours(fetched.sessions), from, ends)
      }
      if (fetched.hrv) counts.hrv = await writeMeasurements(tx, userId, 'hrv', fetched.hrv, from, ends)
      if (fetched.restingHr) {
        counts.restingHr = await writeMeasurements(tx, userId, 'resting_hr', fetched.restingHr, from, ends)
      }
      if (fetched.steps) counts.steps = await writeSteps(tx, userId, fetched.steps, fetchedStepsFrom)
    })

    await db
      .update(googleHealthConnections)
      .set({ lastSyncedAt: new Date(), lastError: errors.length ? errors.join('; ') : null, syncStartedAt: null })
      .where(eq(googleHealthConnections.userId, userId))
    logger.info(
      { userId, full, counts, errorCount: errors.length, durationMs: Date.now() - startedAt },
      'Google Health sync completed'
    )
    return { outcome: 'ok', counts, errors, retryable }
  } catch (error) {
    await db
      .update(googleHealthConnections)
      .set({ syncStartedAt: null, lastError: error instanceof Error ? error.message : 'Sync failed' })
      .where(eq(googleHealthConnections.userId, userId))
    throw error
  }
}

export async function runSyncJob(userId: number, opts: { full?: boolean } = {}): Promise<SyncRun> {
  let result: SyncRun
  try {
    result = await syncGoogleHealth(userId, opts)
  } catch (err) {
    const fields = { err, userId, full: opts.full === true }
    logger.error(wasReported(err) ? { ...fields, sentryCaptured: true } : fields, 'Google Health sync failed')
    throw markReported(err)
  }
  if (result.outcome === 'ok' && result.retryable) {
    throw new RetryableSyncError(`Google Health sync hit a retryable error: ${result.errors.join('; ')}`)
  }
  return result
}

export function toSyncResult(run: SyncRun): SyncResult {
  return run.outcome === 'ok' ? { outcome: 'ok', counts: run.counts, errors: run.errors } : run
}
