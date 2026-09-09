import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  text,
  timestamp,
  unique,
  varchar
} from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'
import { foods, foodServings } from './food'
import { goalProfiles } from './goal'
import { nutrients } from './nutrient'
import { recipes } from './recipe'

export const mealContainers = appSchema.table(
  'meal_containers',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).notNull(),
    sortOrder: integer('sort_order').notNull(),
    isArchived: boolean('is_archived').notNull().default(false)
  },
  (table) => [unique('meal_container_user_name_unique').on(table.userId, table.name)]
)

export const diaryDays = appSchema.table(
  'diary_days',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    notes: text('notes').default(sql`null`),
    goalProfileId: integer('goal_profile_id')
      .default(sql`null`)
      .references(() => goalProfiles.id, { onDelete: 'set null' })
  },
  (table) => [unique('diary_day_user_date_unique').on(table.userId, table.date)]
)

export const diaryDayTargets = appSchema.table(
  'diary_day_targets',
  {
    dayId: integer('day_id')
      .notNull()
      .references(() => diaryDays.id, { onDelete: 'cascade' }),
    nutrientId: integer('nutrient_id')
      .notNull()
      .references(() => nutrients.id),
    amount: numeric('amount').notNull(),
    direction: varchar('direction', { enum: ['min', 'max', 'target'] }).notNull()
  },
  (table) => [primaryKey({ columns: [table.dayId, table.nutrientId] })]
)

export const diaryEntries = appSchema.table(
  'diary_entries',
  {
    ...commonColumns,
    dayId: integer('day_id')
      .notNull()
      .references(() => diaryDays.id, { onDelete: 'cascade' }),
    containerId: integer('container_id')
      .notNull()
      .references(() => mealContainers.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull(),
    loggedAt: timestamp('logged_at').notNull().defaultNow(),
    entryType: varchar('entry_type', { enum: ['food', 'quick_add', 'recipe'] }).notNull(),
    foodId: integer('food_id')
      .default(sql`null`)
      .references(() => foods.id),
    foodServingId: integer('food_serving_id')
      .default(sql`null`)
      .references(() => foodServings.id),
    recipeId: integer('recipe_id')
      .default(sql`null`)
      .references(() => recipes.id),
    quantity: numeric('quantity').notNull(),
    unitLabel: varchar('unit_label', { length: 64 }).notNull(),
    gramsResolved: numeric('grams_resolved').default(sql`null`),
    description: varchar('description', { length: 255 }).default(sql`null`),
    brandSnapshot: varchar('brand_snapshot', { length: 255 }).default(sql`null`),
    ingredientSnapshot: jsonb('ingredient_snapshot').default(sql`null`),
    notes: text('notes').default(sql`null`)
  },
  (table) => [
    check('entry_quantity_positive', sql`quantity > 0`),
    index('diary_entry_day_container_order').on(table.dayId, table.containerId, table.sortOrder)
  ]
)

export const diaryEntryNutrients = appSchema.table(
  'diary_entry_nutrients',
  {
    entryId: integer('entry_id')
      .notNull()
      .references(() => diaryEntries.id, { onDelete: 'cascade' }),
    nutrientId: integer('nutrient_id')
      .notNull()
      .references(() => nutrients.id),
    amount: numeric('amount').notNull()
  },
  (table) => [primaryKey({ columns: [table.entryId, table.nutrientId] })]
)
