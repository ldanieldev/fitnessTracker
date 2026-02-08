import { getTableColumns } from 'drizzle-orm'
import { users } from '~~/server/db/schema'

export default defineEventHandler(async () => {
  const { password, ...userColumns } = getTableColumns(users)

  return db.select(userColumns).from(users)
})
