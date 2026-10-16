import { sql } from 'drizzle-orm'
import { boolean, date, index, integer, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../shared'
import { users } from './users'

export const googleHealthConnections = appSchema.table(
  'google_health_connections',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    googleSub: varchar('google_sub', { length: 255 }).notNull(),
    googleEmail: varchar('google_email', { length: 320 }).notNull(),
    refreshTokenEnc: text('refresh_token_enc').notNull(),
    scopes: text('scopes').array().notNull(),
    syncSteps: boolean('sync_steps').notNull().default(false),
    pushWeight: boolean('push_weight').notNull().default(false),
    status: varchar('status', { enum: ['active', 'reconnect_required'] })
      .notNull()
      .default('active'),
    syncStartedAt: timestamp('sync_started_at').default(sql`null`),
    lastSyncedAt: timestamp('last_synced_at').default(sql`null`),
    lastError: text('last_error').default(sql`null`)
  },
  (table) => [uniqueIndex('google_health_connection_user').on(table.userId)]
)

export const sleepSessions = appSchema.table(
  'sleep_sessions',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    googleId: varchar('google_id', { length: 255 }).notNull(),
    day: date('day').notNull(),
    startAt: timestamp('start_at').notNull(),
    endAt: timestamp('end_at').notNull(),
    mainSleep: boolean('main_sleep').notNull(),
    minutesAsleep: integer('minutes_asleep').notNull(),
    minutesAwake: integer('minutes_awake').notNull(),
    minutesLight: integer('minutes_light').notNull(),
    minutesDeep: integer('minutes_deep').notNull(),
    minutesRem: integer('minutes_rem').notNull()
  },
  (table) => [
    uniqueIndex('sleep_session_google_id').on(table.userId, table.googleId),
    index('sleep_session_user_day').on(table.userId, table.day)
  ]
)
