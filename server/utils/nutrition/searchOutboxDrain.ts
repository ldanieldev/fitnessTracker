import { asc, inArray, isNull } from 'drizzle-orm'
import { searchOutbox } from '~~/server/db/schema'
import { db } from '../db'
import { MeiliSearchProvider } from './meiliSearch'
import { getSearchProvider, isDegradedProvider } from './searchProvider'

interface OutboxRow {
  id: number
  entityId: number
  op: 'upsert' | 'delete'
}

export interface DrainResult {
  processed: number
  failed: number
  skipped: boolean
  rebuilt: boolean
}

export function coalesceOutbox(rows: OutboxRow[]): Array<{ entityId: number, op: 'upsert' | 'delete' }> {
  const last = new Map<number, 'upsert' | 'delete'>()
  // delete+set (not just set) moves a re-touched entity to the end, ordering entries by last row id
  for (const row of rows) {
    last.delete(row.entityId)
    last.set(row.entityId, row.op)
  }
  return [...last.entries()].map(([entityId, op]) => ({ entityId, op }))
}

export async function drainSearchOutbox(limit = 500): Promise<DrainResult> {
  const provider = await getSearchProvider()
  if (isDegradedProvider(provider)) return { processed: 0, failed: 0, skipped: true, rebuilt: false }

  // Existing foods predate the outbox, so an empty index (first run, or after a manual wipe) needs a full rebuild before draining.
  let rebuilt = false
  if (provider instanceof MeiliSearchProvider && (await provider.isEmpty())) {
    await provider.rebuild()
    rebuilt = true
  }

  const rows = await db
    .select({ id: searchOutbox.id, entityId: searchOutbox.entityId, op: searchOutbox.op })
    .from(searchOutbox)
    .where(isNull(searchOutbox.processedAt))
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
  for (const item of coalesceOutbox(rows)) {
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
