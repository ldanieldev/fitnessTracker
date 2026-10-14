import { date, integer, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'

export const dayNotes = appSchema.table(
  'day_notes',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    body: text('body').notNull()
  },
  (table) => [uniqueIndex('day_note_one_per_day').on(table.userId, table.day)]
)
