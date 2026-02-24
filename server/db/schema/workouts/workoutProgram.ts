import { sql } from 'drizzle-orm'
import { date, integer, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { commonColumns } from '../../shared'
import { users } from '../users'
import { workoutTemplates, workoutSessions } from './workout'

export const programs = pgTable(
  'programs',
  {
    ...commonColumns,
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(sql`null`),
    imageUrl: varchar('image_url', { length: 255 }).default(sql`null`),
    totalWeeks: integer('total_weeks').notNull(),
    createdByUserId: integer('created_by_user_id')
      .default(sql`null`)
      .references(() => users.id, { onDelete: 'cascade' })
  }
)

export const programPhases = pgTable(
  'program_phases',
  {
    ...commonColumns,
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    sortOrder: integer('sort_order').notNull(),
    weekStart: integer('week_start').notNull(),
    weekEnd: integer('week_end').notNull()
  }
)

export const programWorkouts = pgTable(
  'program_workouts',
  {
    ...commonColumns,
    phaseId: integer('phase_id')
      .notNull()
      .references(() => programPhases.id, { onDelete: 'cascade' }),
    templateId: integer('template_id')
      .default(sql`null`)
      .references(() => workoutTemplates.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    dayOfWeek: integer('day_of_week').default(sql`null`),
    weekNumber: integer('week_number').notNull(),
    sortOrder: integer('sort_order').notNull()
  }
)

export const userProgramEnrollments = pgTable(
  'user_program_enrollments',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    startDate: date('start_date').notNull(),
    status: varchar('status', { enum: ['active', 'paused', 'completed', 'abandoned'] }).notNull()
  }
)

export const userProgramWorkoutCompletions = pgTable(
  'user_program_workout_completions',
  {
    ...commonColumns,
    enrollmentId: integer('enrollment_id')
      .notNull()
      .references(() => userProgramEnrollments.id, { onDelete: 'cascade' }),
    programWorkoutId: integer('program_workout_id')
      .notNull()
      .references(() => programWorkouts.id, { onDelete: 'cascade' }),
    sessionId: integer('session_id')
      .default(sql`null`)
      .references(() => workoutSessions.id, { onDelete: 'set null' }),
    completionPercent: integer('completion_percent').notNull().default(100),
    completedAt: timestamp('completed_at').notNull()
  },
  (table) => [
    unique('enrollment_workout_unique').on(table.enrollmentId, table.programWorkoutId)
  ]
)
