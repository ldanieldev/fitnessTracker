import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import { searchOutbox } from '~~/server/db/schema'
import { db } from '../db'
import { logger } from '../logger'
import { meiliErrorSummary } from './meiliIndex'

const log = logger.child({ component: 'search' })

export const OUTBOX_MAX_ATTEMPTS = 10
const OUTBOX_RETENTION = sql`now() - interval '7 days'`

interface OutboxRow {
  id: number
  entityId: number
  op: 'upsert' | 'delete'
  attempts?: number
}

export type OutboxEntity = 'food' | 'exercise'

export interface OutboxDrainResult {
  processed: number
  failed: number
  skipped: boolean
  rebuilt: boolean
}

interface DrainTarget {
  index(entityId: number): Promise<void>
  delete(entityId: number): Promise<void>
  rebuild(): Promise<void>
}

export function coalesceOutboxRows(rows: OutboxRow[]): Array<{ entityId: number; op: 'upsert' | 'delete' }> {
  const last = new Map<number, 'upsert' | 'delete'>()
  // delete+set (not just set) moves a re-touched entity to the end, ordering entries by last row id
  for (const row of rows) {
    last.delete(row.entityId)
    last.set(row.entityId, row.op)
  }
  return [...last.entries()].map(([entityId, op]) => ({ entityId, op }))
}

export async function drainOutbox(
  entity: OutboxEntity,
  provider: DrainTarget,
  hooks: { needsRebuild?: () => Promise<boolean> },
  limit = 500
): Promise<OutboxDrainResult> {
  // Existing rows predate the outbox, so an empty index (first run, or a manual wipe) needs a rebuild before draining.
  let rebuilt = false
  if (hooks.needsRebuild && (await hooks.needsRebuild())) {
    await provider.rebuild()
    rebuilt = true
    log.info({ entity }, 'search outbox found an empty index; rebuilt it')
  }

  await pruneOutbox(entity)

  const rows = await db
    .select({
      id: searchOutbox.id,
      entityId: searchOutbox.entityId,
      op: searchOutbox.op,
      attempts: searchOutbox.attempts
    })
    .from(searchOutbox)
    .where(
      and(
        isNull(searchOutbox.processedAt),
        eq(searchOutbox.entity, entity),
        lt(searchOutbox.attempts, OUTBOX_MAX_ATTEMPTS)
      )
    )
    .orderBy(asc(searchOutbox.id))
    .limit(limit)
  if (rows.length === 0) return { processed: 0, failed: 0, skipped: false, rebuilt }

  const rowIdsByEntity = new Map<number, number[]>()
  const lastTryEntities = new Set<number>()
  for (const row of rows) {
    const ids = rowIdsByEntity.get(row.entityId) ?? []
    ids.push(row.id)
    rowIdsByEntity.set(row.entityId, ids)
    if ((row.attempts ?? 0) + 1 >= OUTBOX_MAX_ATTEMPTS) lastTryEntities.add(row.entityId)
  }

  const succeededIds: number[] = []
  const failedIds: number[] = []
  let failed = 0
  for (const item of coalesceOutboxRows(rows)) {
    try {
      if (item.op === 'delete') await provider.delete(item.entityId)
      else await provider.index(item.entityId)
      succeededIds.push(...(rowIdsByEntity.get(item.entityId) ?? []))
    } catch (error) {
      failed++
      failedIds.push(...(rowIdsByEntity.get(item.entityId) ?? []))
      const fields = { entity, entityId: item.entityId, op: item.op }
      if (failed === 1) log.warn({ ...fields, err: meiliErrorSummary(error) }, 'search outbox item failed')
      if (lastTryEntities.has(item.entityId)) log.error(fields, 'search outbox item gave up after max attempts')
    }
  }
  if (failed) log.warn({ entity, failed, processed: succeededIds.length }, 'search outbox drain had failures')

  if (succeededIds.length) {
    await db.update(searchOutbox).set({ processedAt: new Date() }).where(inArray(searchOutbox.id, succeededIds))
  }
  if (failedIds.length) {
    await db
      .update(searchOutbox)
      .set({ attempts: sql`${searchOutbox.attempts} + 1` })
      .where(inArray(searchOutbox.id, failedIds))
  }

  return { processed: succeededIds.length, failed, skipped: false, rebuilt }
}

async function pruneOutbox(entity: OutboxEntity): Promise<void> {
  const deleted = await db
    .delete(searchOutbox)
    .where(
      and(
        eq(searchOutbox.entity, entity),
        or(
          and(isNotNull(searchOutbox.processedAt), lt(searchOutbox.processedAt, OUTBOX_RETENTION)),
          and(gte(searchOutbox.attempts, OUTBOX_MAX_ATTEMPTS), lt(searchOutbox.updatedAt, OUTBOX_RETENTION))
        )
      )
    )
    .returning({ attempts: searchOutbox.attempts })
  const givenUp = deleted.filter((row) => row.attempts >= OUTBOX_MAX_ATTEMPTS).length
  if (givenUp) log.info({ entity, deleted: givenUp }, 'search outbox pruned given-up rows')
}
