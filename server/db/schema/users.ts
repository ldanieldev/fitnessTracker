import { sql } from 'drizzle-orm'
import { boolean, integer, pgTable, unique, varchar } from 'drizzle-orm/pg-core'
import { commonColumns } from '../shared'

export const users = pgTable(
  'users',
  {
    ...commonColumns,
    email: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    age: integer().notNull(),
    sex: varchar({ enum: ['m', 'f'] }).default(sql`null`),
    avatarUrl: varchar('avatar_url', { length: 255 }).default(sql`null`),
    isActive: boolean('is_active').default(true),
    password: varchar({ length: 255 })
  },
  (table) => [unique('users_email_unique').on(table.email)]
)

export const authProviders = pgTable(
  'auth_providers',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar({ length: 50 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull()
  },
  (table) => [
    unique('auth_providers_provider_account_unique').on(table.provider, table.providerAccountId)
  ]
)
