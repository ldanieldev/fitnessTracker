import { sql } from 'drizzle-orm'
import { date, index, integer, jsonb, numeric, primaryKey, timestamp, varchar } from 'drizzle-orm/pg-core'
import { GRAPH_METRIC_VALUES, LOAD_STYLE_VALUES, TRACKING_TYPE_VALUES } from '../../../../shared/types/workout'
import { appSchema } from '../../shared'
import { users } from '../users'
import { exercises } from './exercise'
import { workoutSessions } from './workout'

export const workoutExerciseRollups = appSchema.table(
  'workout_exercise_rollups',
  {
    sessionId: integer('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    performedOn: date('performed_on').notNull(),
    trackingType: varchar('tracking_type', { enum: TRACKING_TYPE_VALUES }).notNull(),
    loadStyle: varchar('load_style', { enum: LOAD_STYLE_VALUES }).default(sql`null`),
    setCount: integer('set_count').notNull(),
    totalReps: integer('total_reps').notNull(),
    totalVolume: numeric('total_volume').default(sql`null`),
    topWeight: numeric('top_weight').default(sql`null`),
    topWeightReps: integer('top_weight_reps').default(sql`null`),
    topSetVolume: numeric('top_set_volume').default(sql`null`),
    bestE1rm: numeric('best_e1rm').default(sql`null`),
    weightByReps: jsonb('weight_by_reps').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    totalDistanceMeters: numeric('total_distance_meters').default(sql`null`),
    totalDurationSeconds: integer('total_duration_seconds').default(sql`null`),
    bestPace: numeric('best_pace').default(sql`null`)
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.exerciseId] }),
    index('workout_rollup_series').on(table.userId, table.exerciseId, table.performedOn)
  ]
)

export const workoutExerciseGoals = appSchema.table(
  'workout_exercise_goals',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    metric: varchar('metric', { enum: GRAPH_METRIC_VALUES }).notNull(),
    targetValue: numeric('target_value').notNull(),
    targetReps: integer('target_reps').default(sql`null`),
    targetDate: date('target_date').default(sql`null`),
    achievedAt: timestamp('achieved_at').default(sql`null`),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.userId, table.exerciseId, table.metric] })]
)
