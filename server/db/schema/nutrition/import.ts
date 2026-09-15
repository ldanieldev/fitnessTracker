import { sql } from 'drizzle-orm'
import { integer, jsonb, text, varchar } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'

export const importJobs = appSchema.table('import_jobs', {
  ...commonColumns,
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  source: varchar('source', { enum: ['mymacros'] }).notNull(),
  status: varchar('status', { enum: ['queued', 'running', 'done', 'failed'] }).notNull().default('queued'),
  fileCount: integer('file_count').notNull(),
  payload: jsonb('payload').notNull(),
  result: jsonb('result').default(sql`null`),
  error: text('error').default(sql`null`)
})
