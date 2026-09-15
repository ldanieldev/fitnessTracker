import { sql } from 'drizzle-orm'
import { boolean, index, integer, numeric, primaryKey, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'
import { nutrients } from './nutrient'

export const goalProfiles = appSchema.table(
  'goal_profiles',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    inputMode: varchar('input_mode', { enum: ['grams', 'ratio'] }).notNull(),
    calories: numeric('calories').default(sql`null`),
    isDefault: boolean('is_default').notNull().default(false),
    deletedAt: timestamp('deleted_at').default(sql`null`)
  },
  (table) => [
    uniqueIndex('goal_profile_one_default')
      .on(table.userId)
      .where(sql`is_default and deleted_at is null`)
  ]
)

export const goalProfileTargets = appSchema.table(
  'goal_profile_targets',
  {
    profileId: integer('profile_id')
      .notNull()
      .references(() => goalProfiles.id, { onDelete: 'cascade' }),
    nutrientId: integer('nutrient_id')
      .notNull()
      .references(() => nutrients.id),
    amount: numeric('amount').notNull(),
    direction: varchar('direction', { enum: ['min', 'max', 'target'] }).notNull(),
    ratioPercent: numeric('ratio_percent').default(sql`null`)
  },
  (table) => [primaryKey({ columns: [table.profileId, table.nutrientId] })]
)

export const searchOutbox = appSchema.table(
  'search_outbox',
  {
    ...commonColumns,
    entity: varchar('entity', { length: 32 }).notNull(),
    entityId: integer('entity_id').notNull(),
    op: varchar('op', { enum: ['upsert', 'delete'] }).notNull(),
    processedAt: timestamp('processed_at').default(sql`null`)
  },
  (table) => [index('search_outbox_pending').on(table.id).where(sql`processed_at is null`)]
)
