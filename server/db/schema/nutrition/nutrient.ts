import { boolean, integer, primaryKey, unique, varchar } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'

export const nutrients = appSchema.table(
  'nutrients',
  {
    ...commonColumns,
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    unit: varchar('unit', { enum: ['kcal', 'g', 'mg', 'mcg'] }).notNull(),
    isMacro: boolean('is_macro').notNull().default(false),
    defaultDirection: varchar('default_direction', { enum: ['min', 'max', 'target'] })
      .notNull()
      .default('target'),
    sortOrder: integer('sort_order').notNull()
  },
  (table) => [unique('nutrient_key_unique').on(table.key)]
)

export const userTrackedNutrients = appSchema.table(
  'user_tracked_nutrients',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    nutrientId: integer('nutrient_id')
      .notNull()
      .references(() => nutrients.id),
    sortOrder: integer('sort_order').notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.nutrientId] })]
)
