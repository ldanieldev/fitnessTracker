import { date, integer, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'

export const stepDays = appSchema.table(
  'step_days',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    steps: integer('steps').notNull(),
    source: varchar('source', { length: 16 }).notNull().default('manual')
  },
  (table) => [uniqueIndex('step_day_one_per_day').on(table.userId, table.day)]
)

export const stepTargets = appSchema.table(
  'step_targets',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dailyTarget: integer('daily_target').notNull(),
    effectiveFrom: date('effective_from').notNull()
  },
  (table) => [uniqueIndex('step_target_one_per_date').on(table.userId, table.effectiveFrom)]
)
