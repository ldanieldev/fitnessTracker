import { sql } from 'drizzle-orm'
import { date, integer, numeric, uniqueIndex } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'
import { measurementTypes } from './types'

export const measurementGoals = appSchema.table(
  'measurement_goals',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    typeId: integer('type_id')
      .notNull()
      .references(() => measurementTypes.id, { onDelete: 'cascade' }),
    targetValue: numeric('target_value').notNull(),
    targetDate: date('target_date').default(sql`null`),
    startValue: numeric('start_value').notNull(),
    startDate: date('start_date').notNull()
  },
  (table) => [uniqueIndex('measurement_goal_one_per_type').on(table.userId, table.typeId)]
)
