import { integer, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { appSchema, commonColumns } from '../shared'
import { users } from './users'

export const accessTokens = appSchema.table(
  'access_tokens',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    prefix: varchar('prefix', { length: 8 }).notNull(),
    lastUsedAt: timestamp('last_used_at').default(sql`null`)
  },
  (table) => [
    uniqueIndex('access_token_hash').on(table.tokenHash),
    uniqueIndex('access_token_name_per_user').on(table.userId, table.name)
  ]
)
