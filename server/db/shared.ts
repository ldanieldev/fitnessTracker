import { integer, pgSchema, timestamp } from 'drizzle-orm/pg-core'

export const APP_SCHEMA_NAME = 'app'

export const appSchema = pgSchema(APP_SCHEMA_NAME)

export const commonColumns = {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
}
