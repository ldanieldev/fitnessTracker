import { and, type SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type { DbClient } from '~~/server/utils/db'

interface SparsePrefRow<T extends PgTable> {
  table: T
  key: Partial<T['$inferInsert']>
  target: PgColumn[]
  where: SQL | undefined
  empty: SQL | undefined
}

// A pref row lives only while it overrides something, so a patch that clears the last override deletes it.
export async function writeSparsePref<T extends PgTable>(
  tx: DbClient,
  row: SparsePrefRow<T>,
  patch: Partial<T['$inferInsert']>
): Promise<void> {
  if (Object.keys(patch).length === 0) return
  await tx
    .insert(row.table)
    // Two Partials never prove the required columns; the key supplies them (user id + the pref's target id).
    .values({ ...row.key, ...patch } as T['$inferInsert'])
    .onConflictDoUpdate({ target: row.target, set: patch })
  await tx.delete(row.table).where(and(row.where, row.empty))
}
