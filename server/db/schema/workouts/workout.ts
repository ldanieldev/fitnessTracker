import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  numeric,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'
import { LOAD_STYLE_VALUES, TRACKING_TYPE_VALUES } from '../../../../shared/types/workout'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'
import { exercises } from './exercise'

export const routines = appSchema.table(
  'routines',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    notes: text('notes').default(sql`null`),
    active: boolean('active').notNull().default(false),
    nextDayId: integer('next_day_id').references((): AnyPgColumn => workoutTemplates.id, { onDelete: 'set null' })
  },
  (table) => [uniqueIndex('routine_one_active').on(table.userId).where(sql`active`)]
)

export const workoutTemplates = appSchema.table(
  'workout_templates',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    routineId: integer('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(sql`null`),
    sortOrder: integer('sort_order').notNull(),
    floating: boolean('floating').notNull().default(false)
  },
  (table) => [index('workout_template_routine').on(table.routineId, table.sortOrder)]
)

export const workoutTemplateEntries = appSchema.table(
  'workout_template_entries',
  {
    ...commonColumns,
    templateId: integer('template_id')
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull(),
    targetSets: integer('target_sets').default(sql`null`),
    targetLow: numeric('target_low').default(sql`null`),
    targetHigh: numeric('target_high').default(sql`null`),
    targetWeight: numeric('target_weight').default(sql`null`),
    supersetGroup: smallint('superset_group').default(sql`null`),
    optional: boolean('optional').notNull().default(false),
    restSeconds: integer('rest_seconds').default(sql`null`),
    notes: varchar('notes', { length: 500 }).default(sql`null`)
  },
  (table) => [index('workout_template_entry_template').on(table.templateId, table.sortOrder)]
)

export const workoutSessions = appSchema.table(
  'workout_sessions',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).default(sql`null`),
    performedOn: date('performed_on').notNull(),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    endedAt: timestamp('ended_at').default(sql`null`),
    notes: text('notes').default(sql`null`),
    routineDayId: integer('routine_day_id').references(() => workoutTemplates.id, { onDelete: 'set null' })
  },
  (table) => [
    uniqueIndex('workout_session_open').on(table.userId).where(sql`ended_at is null`),
    index('workout_session_recent').on(table.userId, table.performedOn, table.id)
  ]
)

export const workoutEntries = appSchema.table(
  'workout_entries',
  {
    ...commonColumns,
    sessionId: integer('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull(),
    trackingType: varchar('tracking_type', { enum: TRACKING_TYPE_VALUES }).notNull(),
    loadStyle: varchar('load_style', { enum: LOAD_STYLE_VALUES }).default(sql`null`),
    notes: text('notes').default(sql`null`),
    targetSets: integer('target_sets').default(sql`null`),
    targetLow: numeric('target_low').default(sql`null`),
    targetHigh: numeric('target_high').default(sql`null`),
    targetWeight: numeric('target_weight').default(sql`null`),
    supersetGroup: smallint('superset_group').default(sql`null`),
    optional: boolean('optional').notNull().default(false),
    restSeconds: integer('rest_seconds').default(sql`null`)
  },
  (table) => [index('workout_entry_exercise').on(table.exerciseId)]
)

export const workoutSets = appSchema.table(
  'workout_sets',
  {
    ...commonColumns,
    entryId: integer('entry_id')
      .notNull()
      .references(() => workoutEntries.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    weight: numeric('weight').default(sql`null`),
    reps: integer('reps').default(sql`null`),
    distanceMeters: numeric('distance_meters').default(sql`null`),
    durationSeconds: integer('duration_seconds').default(sql`null`),
    done: boolean('done').notNull().default(false),
    comment: varchar('comment', { length: 500 }).default(sql`null`)
  },
  (table) => [index('workout_set_entry').on(table.entryId, table.sortOrder)]
)
