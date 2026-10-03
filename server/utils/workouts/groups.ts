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

export async function regroup(
  tx: DbClient,
  groups: GroupedTable,
  parentId: number,
  change: (items: GroupItem[]) => GroupItem[]
): Promise<void> {
  const result = await tx.execute<{ id: number, superset_group: number | null }>(sql`
    select ${groups.id} as id, ${groups.supersetGroup} as superset_group from ${groups.table}
    where ${groups.parent} = ${parentId} order by ${groups.sortOrder}, ${groups.id}
  `)
  const items = result.rows.map((row) => ({
    id: Number(row.id),
    supersetGroup: row.superset_group === null ? null : Number(row.superset_group)
  }))
  const sortOrderName = sql.identifier(groups.sortOrder.name)
  const groupName = sql.identifier(groups.supersetGroup.name)
  for (const [index, item] of change(items).entries()) {
    await tx.execute(sql`update ${groups.table} set ${sortOrderName} = ${index}, ${groupName} = ${item.supersetGroup} where ${groups.id} = ${item.id}`)
  }
}

export function groupOrThrow(items: GroupItem[], ids: number[]): GroupItem[] {
  const unique = [...new Set(ids)]
  if (unique.length < 2 || unique.some((id) => !items.some((item) => item.id === id))) {
    throw createError({ statusCode: 400, statusMessage: 'Pick at least two exercises from this list' })
  }
  return groupItems(items, unique)
}
