import { sql } from 'drizzle-orm'
import { integer, numeric, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { commonColumns } from '../../shared'
import { users } from '../users'
import { exercises } from './exercise'

export const workoutTemplates = pgTable(
  'workout_templates',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(sql`null`)
  }
)

export const workoutTemplateEntries = pgTable(
  'workout_template_entries',
  {
    ...commonColumns,
    templateId: integer('template_id')
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    entryType: varchar('entry_type', { enum: ['strength', 'cardio', 'program'] }).notNull(),
    targetSets: integer('target_sets').default(sql`null`),
    targetReps: integer('target_reps').default(sql`null`),
    targetWeight: numeric('target_weight').default(sql`null`),
    targetDurationSeconds: integer('target_duration_seconds').default(sql`null`),
    targetDistanceMeters: numeric('target_distance_meters').default(sql`null`)
  }
)

export const workoutSessions = pgTable(
  'workout_sessions',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    templateId: integer('template_id')
      .default(sql`null`)
      .references(() => workoutTemplates.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).default(sql`null`),
    startedAt: timestamp('started_at').notNull(),
    completedAt: timestamp('completed_at').default(sql`null`),
    notes: text('notes').default(sql`null`)
  }
)

export const workoutEntries = pgTable(
  'workout_entries',
  {
    ...commonColumns,
    sessionId: integer('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    entryType: varchar('entry_type', { enum: ['strength', 'cardio', 'program'] }).notNull(),
    durationSeconds: integer('duration_seconds').default(sql`null`),
    distanceMeters: numeric('distance_meters').default(sql`null`),
    calories: integer('calories').default(sql`null`),
    avgPace: numeric('avg_pace').default(sql`null`),
    notes: text('notes').default(sql`null`)
  }
)

export const workoutSets = pgTable(
  'workout_sets',
  {
    ...commonColumns,
    entryId: integer('entry_id')
      .notNull()
      .references(() => workoutEntries.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    weight: numeric('weight').notNull(),
    reps: integer('reps').notNull(),
    rpe: integer('rpe').default(sql`null`)
  }
)
