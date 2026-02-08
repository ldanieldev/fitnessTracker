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
    avatarUrl: varchar({ length: 255 }).default(sql`null`),
    isActive: boolean().default(true),
    password: varchar({ length: 255 })
  },
  (table) => [unique('users_email_unique').on(table.email)]
)
