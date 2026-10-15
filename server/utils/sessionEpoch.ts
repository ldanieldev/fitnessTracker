import { sql } from 'drizzle-orm'
import { users } from '../db/schema'

export const nextEpoch = sql`${users.sessionEpoch} + 1`

export function sessionRejected(
  row: { isActive: boolean | null; sessionEpoch: number } | undefined,
  epoch: number | undefined
): boolean {
  return !row || row.isActive === false || row.sessionEpoch !== (epoch ?? 0)
}
