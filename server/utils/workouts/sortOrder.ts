import { sql } from 'drizzle-orm'
import type { AnyPgColumn, AnyPgTable } from 'drizzle-orm/pg-core'
import type { DbClient } from '~~/server/utils/db'

export async function siblingIds(
  tx: DbClient,
  table: AnyPgTable,
  idColumn: AnyPgColumn,
  sortOrderColumn: AnyPgColumn,
  fkColumn: AnyPgColumn,
  fkValue: number
): Promise<number[]> {
  const result = await tx.execute<{ id: number }>(
    sql`select ${idColumn} as id from ${table} where ${fkColumn} = ${fkValue} order by ${sortOrderColumn}, ${idColumn}`
  )
  return result.rows.map((row) => Number(row.id))
}

export async function renumberSiblings(
  tx: DbClient,
  table: AnyPgTable,
  idColumn: AnyPgColumn,
  sortOrderColumn: AnyPgColumn,
  ids: number[]
): Promise<void> {
  // a SET target must be a bare column name — a qualified reference like ${sortOrderColumn} is rejected by Postgres.
  const sortOrderName = sql.identifier(sortOrderColumn.name)
  // sequential, not Promise.all: concurrent queries on one transaction client make node-postgres log a deprecation warning.
  for (const [index, id] of ids.entries()) {
    await tx.execute(sql`update ${table} set ${sortOrderName} = ${index} where ${idColumn} = ${id}`)
  }
}
