import { date, index, integer, numeric, timestamp } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'
import { measurementTypes } from './types'

export const measurements = appSchema.table(
  'measurements',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    typeId: integer('type_id')
      .notNull()
      .references(() => measurementTypes.id),
    value: numeric('value').notNull(),
    measuredAt: timestamp('measured_at').notNull().defaultNow(),
    measuredOn: date('measured_on').notNull()
  },
  (table) => [index('measurement_user_type_day').on(table.userId, table.typeId, table.measuredOn)]
)
