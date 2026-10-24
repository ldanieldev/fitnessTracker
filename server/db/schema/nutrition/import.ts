import { sql } from 'drizzle-orm'
import { index, integer, jsonb, text, varchar } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'

export const importJobs = appSchema.table(
  'import_jobs',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: varchar('source', { enum: ['mymacros', 'fitnotes'] }).notNull(),
    status: varchar('status', { enum: ['queued', 'running', 'done', 'failed'] })
      .notNull()
      .default('queued'),
    fileCount: integer('file_count').notNull(),
    payload: jsonb('payload').notNull(),
    timeZone: varchar('time_zone', { length: 64 }),
    result: jsonb('result').default(sql`null`),
    error: text('error').default(sql`null`)
  },
  (table) => [index('import_job_user').on(table.userId)]
)
