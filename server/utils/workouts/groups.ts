import { sql } from 'drizzle-orm'
import type { AnyPgColumn, AnyPgTable } from 'drizzle-orm/pg-core'
import { workoutEntries, workoutTemplateEntries } from '~~/server/db/schema'
import type { DbClient } from '~~/server/utils/db'
import { groupItems, type GroupItem } from '~~/shared/utils/supersets'

export interface GroupedTable {
  table: AnyPgTable
  id: AnyPgColumn
  sortOrder: AnyPgColumn
  supersetGroup: AnyPgColumn
  parent: AnyPgColumn
}

export const ROUTINE_ENTRY_GROUPS: GroupedTable = {
  table: workoutTemplateEntries,
  id: workoutTemplateEntries.id,
  sortOrder: workoutTemplateEntries.sortOrder,
  supersetGroup: workoutTemplateEntries.supersetGroup,
  parent: workoutTemplateEntries.templateId
}

export const SESSION_ENTRY_GROUPS: GroupedTable = {
  table: workoutEntries,
  id: workoutEntries.id,
  sortOrder: workoutEntries.sortOrder,
  supersetGroup: workoutEntries.supersetGroup,
  parent: workoutEntries.sessionId
}

// Id order keeps every locker in one order; NO KEY UPDATE still lets set inserts take their FK KEY SHARE meanwhile.
export async function lockGroupRows(tx: DbClient, groups: GroupedTable, parentId: number) {
  const result = await tx.execute<{ id: number; sort_order: number; superset_group: number | null }>(sql`
    select ${groups.id} as id, ${groups.sortOrder} as sort_order, ${groups.supersetGroup} as superset_group
    from ${groups.table} where ${groups.parent} = ${parentId} order by ${groups.id} for no key update
  `)
  return result.rows
    .map((row) => ({
      id: Number(row.id),
      sortOrder: Number(row.sort_order),
      supersetGroup: row.superset_group === null ? null : Number(row.superset_group)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
}

export async function regroup(
  tx: DbClient,
  groups: GroupedTable,
  parentId: number,
  change: (items: GroupItem[]) => GroupItem[]
): Promise<void> {
  const rows = await lockGroupRows(tx, groups, parentId)
  const stored = new Map(rows.map((row) => [row.id, row]))
  const items = rows.map((row) => ({ id: row.id, supersetGroup: row.supersetGroup }))
  const sortOrderName = sql.identifier(groups.sortOrder.name)
  const groupName = sql.identifier(groups.supersetGroup.name)
  for (const [index, item] of change(items).entries()) {
    const was = stored.get(item.id)
    if (was && was.sortOrder === index && was.supersetGroup === item.supersetGroup) continue
    await tx.execute(
      sql`update ${groups.table} set ${sortOrderName} = ${index}, ${groupName} = ${item.supersetGroup}
        where ${groups.id} = ${item.id}`
    )
  }
}

export function groupOrThrow(items: GroupItem[], ids: number[]): GroupItem[] {
  const unique = [...new Set(ids)]
  if (unique.length < 2 || unique.some((id) => !items.some((item) => item.id === id))) {
    throw createError({ statusCode: 400, statusMessage: 'Pick at least two exercises from this list' })
  }
  return groupItems(items, unique)
}
