import { sql } from 'drizzle-orm'
import { boolean, integer, jsonb, pgTable, primaryKey, unique, varchar } from 'drizzle-orm/pg-core'
import { commonColumns } from '../../shared'
import { users } from '../users'

export const bodyParts = pgTable(
  'body_parts',
  {
    ...commonColumns,
    name: varchar('name', { length: 255 }).notNull(),
    imageUrl: varchar('image_url', { length: 255 }).default(sql`null`)
  },
  (table) => [unique('body_part_name').on(table.name)]
)

export const muscles = pgTable(
  'muscles',
  {
    ...commonColumns,
    name: varchar('name', { length: 255 }).notNull(),
    bodyPartId: integer('body_part_id')
      .notNull()
      .references(() => bodyParts.id, { onDelete: 'cascade' })
  },
  (table) => [unique('muscle_name').on(table.name)]
)

export const equipment = pgTable(
  'equipment',
  {
    ...commonColumns,
    name: varchar('name', { length: 255 }).notNull()
  },
  (table) => [unique('equipment_name').on(table.name)]
)

export const exerciseTypes = pgTable(
  'exercise_types',
  {
    ...commonColumns,
    name: varchar('name', { length: 255 }).notNull()
  },
  (table) => [unique('exercise_type_name').on(table.name)]
)

export const exercises = pgTable(
  'exercises',
  {
    ...commonColumns,
    name: varchar('name', { length: 255 }).notNull(),
    exerciseTypeId: integer('exercise_type_id')
      .default(sql`null`)
      .references(() => exerciseTypes.id, { onDelete: 'cascade' }),
    difficulty: varchar('difficulty', { enum: ['beginner', 'intermediate', 'advanced'] }).default(sql`null`),
    imageUrl: varchar('image_url', { length: 255 }).default(sql`null`),
    videoUrl: varchar('video_url', { length: 255 }).default(sql`null`),
    instructions: jsonb('instructions').$type<string[]>().default(sql`null`),
    createdByUserId: integer('created_by_user_id')
      .default(sql`null`)
      .references(() => users.id, { onDelete: 'cascade' })
  },
  (table) => [unique('exercise_name_user').on(table.name, table.createdByUserId)]
)

export const exerciseMuscles = pgTable(
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

export const exerciseEquipment = pgTable(
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
