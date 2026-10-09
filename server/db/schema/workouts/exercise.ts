import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  smallint,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'
import { LOAD_STYLE_VALUES, TRACKING_TYPE_VALUES } from '../../../../shared/types/workout'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'

export const exerciseCategories = appSchema.table(
  'exercise_categories',
  {
    ...commonColumns,
    userId: integer('user_id')
      .default(sql`null`)
      .references(() => users.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 64 }).default(sql`null`),
    name: varchar('name', { length: 64 }).notNull(),
    color: varchar('color', { length: 32 }).notNull(),
    sortOrder: smallint('sort_order').notNull().default(0),
    deletedAt: timestamp('deleted_at').default(sql`null`)
  },
  (table) => [
    uniqueIndex('exercise_category_shared_key')
      .on(table.key)
      .where(sql`user_id is null`),
    uniqueIndex('exercise_category_user_name')
      .on(table.userId, sql`lower(name)`)
      .where(sql`user_id is not null and deleted_at is null`)
  ]
)

export const muscles = appSchema.table(
  'muscles',
  {
    ...commonColumns,
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    categoryKey: varchar('category_key', { length: 64 }).notNull(),
    bodyMapGroups: jsonb('body_map_groups')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`)
  },
  (table) => [uniqueIndex('muscle_key').on(table.key)]
)

export const equipment = appSchema.table(
  'equipment',
  {
    ...commonColumns,
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 64 }).notNull()
  },
  (table) => [uniqueIndex('equipment_key').on(table.key)]
)

export const exercises = appSchema.table(
  'exercises',
  {
    ...commonColumns,
    name: varchar('name', { length: 255 }).notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => exerciseCategories.id, { onDelete: 'restrict' }),
    trackingType: varchar('tracking_type', { enum: TRACKING_TYPE_VALUES }).notNull(),
    loadStyle: varchar('load_style', { enum: LOAD_STYLE_VALUES }).default(sql`null`),
    barWeight: numeric('bar_weight').default(sql`null`),
    difficulty: varchar('difficulty', { enum: ['beginner', 'intermediate', 'advanced'] }).default(sql`null`),
    instructions: jsonb('instructions')
      .$type<string[]>()
      .default(sql`null`),
    images: jsonb('images')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    externalId: varchar('external_id', { length: 128 }).default(sql`null`),
    createdByUserId: integer('created_by_user_id')
      .default(sql`null`)
      .references(() => users.id, { onDelete: 'cascade' }),
    deletedAt: timestamp('deleted_at').default(sql`null`)
  },
  (table) => [
    uniqueIndex('exercise_external_id')
      .on(table.externalId)
      .where(sql`created_by_user_id is null`),
    uniqueIndex('exercise_user_name')
      .on(table.createdByUserId, sql`lower(name)`)
      .where(sql`created_by_user_id is not null and deleted_at is null`),
    index('exercise_owner_live').on(table.createdByUserId, table.deletedAt)
  ]
)

export const exerciseMuscles = appSchema.table(
  'exercise_muscles',
  {
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    muscleId: integer('muscle_id')
      .notNull()
      .references(() => muscles.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(true)
  },
  (table) => [primaryKey({ columns: [table.exerciseId, table.muscleId] })]
)

export const exerciseEquipment = appSchema.table(
  'exercise_equipment',
  {
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    equipmentId: integer('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' })
  },
  (table) => [primaryKey({ columns: [table.exerciseId, table.equipmentId] })]
)
