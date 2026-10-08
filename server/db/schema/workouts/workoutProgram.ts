import { sql } from 'drizzle-orm'
import { boolean, check, date, index, integer, smallint, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'
import { routines } from './workout'

export const programs = appSchema.table(
  'programs',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(sql`null`)
  },
  (table) => [index('program_user').on(table.userId)]
)

export const programPhases = appSchema.table(
  'program_phases',
  {
    ...commonColumns,
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    sortOrder: integer('sort_order').notNull(),
    weeks: smallint('weeks').notNull(),
    // set null, not no action: a user delete cascades to routines before phases; in-app deletes of a used routine are refused (409).
    routineId: integer('routine_id').references(() => routines.id, { onDelete: 'set null' }),
    deload: boolean('deload').notNull().default(false)
  },
  (table) => [
    index('program_phase_program').on(table.programId, table.sortOrder),
    check('program_phases_weeks_check', sql`${table.weeks} >= 1`)
  ]
)

export const userProgramEnrollments = appSchema.table(
  'user_program_enrollments',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    status: varchar('status', { enum: ['active', 'paused', 'completed', 'abandoned'] }).notNull(),
    anchorDate: date('anchor_date').notNull(),
    anchorWeek: smallint('anchor_week').notNull(),
    pausedWeek: smallint('paused_week').default(sql`null`),
    currentPhaseId: integer('current_phase_id').references(() => programPhases.id, { onDelete: 'set null' }),
    notice: varchar('notice', { enum: ['phase', 'complete'] }).default(sql`null`)
  },
  (table) => [
    uniqueIndex('enrollment_one_live').on(table.userId).where(sql`status in ('active', 'paused')`),
    index('enrollment_program').on(table.programId)
  ]
)
