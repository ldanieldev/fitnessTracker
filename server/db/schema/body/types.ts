import { sql } from 'drizzle-orm'
import { boolean, integer, primaryKey, smallint, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'

export const measurementTypes = appSchema.table(
  'measurement_types',
  {
    ...commonColumns,
    userId: integer('user_id')
      .default(sql`null`)
      .references(() => users.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 64 }).default(sql`null`),
    name: varchar('name', { length: 64 }).notNull(),
    unit: varchar('unit', { length: 16 }).notNull(),
    precision: smallint('precision').notNull().default(1),
    direction: varchar('direction', { enum: ['lower', 'higher', 'neutral'] }).notNull().default('neutral'),
    deletedAt: timestamp('deleted_at').default(sql`null`)
  },
  (table) => [
    uniqueIndex('measurement_type_builtin_key').on(table.key).where(sql`user_id is null`),
    uniqueIndex('measurement_type_user_name')
      .on(table.userId, sql`lower(name)`)
      .where(sql`user_id is not null and deleted_at is null`)
  ]
)

export const measurementTypePrefs = appSchema.table(
  'measurement_type_prefs',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    typeId: integer('type_id')
      .notNull()
      .references(() => measurementTypes.id, { onDelete: 'cascade' }),
    hidden: boolean('hidden').notNull().default(false),
    sortOrder: integer('sort_order').default(sql`null`)
  },
  (table) => [primaryKey({ columns: [table.userId, table.typeId] })]
)
