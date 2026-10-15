import { getTableColumns, sql, type SQL } from 'drizzle-orm'
import { users } from '../db/schema'
import { db } from './db'
import { isUniqueViolation } from './pgError'

const { password: _password, ...rowColumns } = getTableColumns(users)

type NewUser = Omit<typeof users.$inferInsert, 'isAdmin' | 'sessionEpoch'>

// Two first signups can both see an empty table; the users_one_admin index rejects the loser, which retries as a user.
export async function insertUser(values: NewUser) {
  const insert = (isAdmin: boolean | SQL) =>
    db
      .insert(users)
      .values({ ...values, isAdmin })
      .returning(rowColumns)
      .then((r) => r[0]!)
  try {
    return await insert(sql`not exists (select 1 from ${users})`)
  } catch (error) {
    if (!isUniqueViolation(error, 'users_one_admin')) throw error
    return insert(false)
  }
}
