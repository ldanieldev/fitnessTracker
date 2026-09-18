import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { searchOutbox } from '~~/server/db/schema'
import { db } from '../db'

interface OutboxRow {
  id: number
  entityId: number
  op: 'upsert' | 'delete'
}

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

export function coalesceOutboxRows(rows: OutboxRow[]): Array<{ entityId: number, op: 'upsert' | 'delete' }> {
  const last = new Map<number, 'upsert' | 'delete'>()
  // delete+set (not just set) moves a re-touched entity to the end, ordering entries by last row id
  for (const row of rows) {
    last.delete(row.entityId)
    last.set(row.entityId, row.op)
  }
  return [...last.entries()].map(([entityId, op]) => ({ entityId, op }))
}

export async function drainOutbox(
  entity: string,
  provider: DrainTarget,
  hooks: { isEmpty?: () => Promise<boolean> },
  limit = 500
): Promise<OutboxDrainResult> {
  // Existing rows predate the outbox, so an empty index (first run, or a manual wipe) needs a rebuild before draining.
  let rebuilt = false
  if (hooks.isEmpty && (await hooks.isEmpty())) {
    await provider.rebuild()
    rebuilt = true
  }

  const rows = await db
    .select({ id: searchOutbox.id, entityId: searchOutbox.entityId, op: searchOutbox.op })
    .from(searchOutbox)
    .where(and(isNull(searchOutbox.processedAt), eq(searchOutbox.entity, entity)))
    .orderBy(asc(searchOutbox.id))
    .limit(limit)
  if (rows.length === 0) return { processed: 0, failed: 0, skipped: false, rebuilt }

  const rowIdsByEntity = new Map<number, number[]>()
  for (const row of rows) {
    const ids = rowIdsByEntity.get(row.entityId) ?? []
    ids.push(row.id)
    rowIdsByEntity.set(row.entityId, ids)
  }

  const succeededIds: number[] = []
  let failed = 0
  for (const item of coalesceOutboxRows(rows)) {
    try {
      if (item.op === 'delete') await provider.delete(item.entityId)
      else await provider.index(item.entityId)
      succeededIds.push(...(rowIdsByEntity.get(item.entityId) ?? []))
    } catch {
      failed++
    }
  }

  if (succeededIds.length) {
    await db.update(searchOutbox).set({ processedAt: new Date() }).where(inArray(searchOutbox.id, succeededIds))
  }

  return { processed: succeededIds.length, failed, skipped: false, rebuilt }
}
