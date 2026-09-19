import { sql } from 'drizzle-orm'
import { boolean, check, integer, numeric, primaryKey, smallint, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { LOAD_STYLE_VALUES, TRACKING_TYPE_VALUES } from '../../../../shared/types/workout'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'
import { exerciseCategories, exercises } from './exercise'

export const exercisePrefs = appSchema.table(
  'exercise_prefs',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .default(sql`null`)
      .references(() => exerciseCategories.id, { onDelete: 'set null' }),
    trackingType: varchar('tracking_type', { enum: TRACKING_TYPE_VALUES }).default(sql`null`),
    loadStyle: varchar('load_style', { enum: LOAD_STYLE_VALUES }).default(sql`null`),
    barWeight: numeric('bar_weight').default(sql`null`),
    weightIncrement: numeric('weight_increment').default(sql`null`),
    restSeconds: integer('rest_seconds').default(sql`null`),
    plateSizes: numeric('plate_sizes').array().default(sql`null`),
    notes: varchar('notes', { length: 2000 }).default(sql`null`),
    link: varchar('link', { length: 500 }).default(sql`null`),
    favorite: boolean('favorite').notNull().default(false),
    hiddenAt: timestamp('hidden_at').default(sql`null`)
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.exerciseId] }),
    check(
      'exercise_prefs_plate_sizes_check',
      sql`${table.plateSizes} is null or (cardinality(${table.plateSizes}) between 1 and 12 and 0 < all(${table.plateSizes}) and 100 >= all(${table.plateSizes}))`
    )
  ]
)

export const exerciseCategoryPrefs = appSchema.table(
  'exercise_category_prefs',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => exerciseCategories.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).default(sql`null`),
    color: varchar('color', { length: 32 }).default(sql`null`),
    sortOrder: smallint('sort_order').default(sql`null`),
    hiddenAt: timestamp('hidden_at').default(sql`null`)
  },
  (table) => [primaryKey({ columns: [table.userId, table.categoryId] })]
)

export const exerciseVariationGroups = appSchema.table(
  'exercise_variation_groups',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).notNull()
  },
  (table) => [uniqueIndex('variation_group_user_name').on(table.userId, sql`lower(name)`)]
)

export const exerciseVariationMembers = appSchema.table(
  'exercise_variation_members',
  {
    groupId: integer('group_id')
      .notNull()
      .references(() => exerciseVariationGroups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.exerciseId] }),
    uniqueIndex('variation_member_one_group').on(table.userId, table.exerciseId)
  ]
)
