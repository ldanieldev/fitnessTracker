import { sql } from 'drizzle-orm'
import { check, integer, numeric, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'
import { foods, foodServings } from './food'

export const recipes = appSchema.table(
  'recipes',
  {
    ...commonColumns,
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    servings: numeric('servings').notNull(),
    servingName: varchar('serving_name', { length: 64 }).notNull(),
    finishedWeightG: numeric('finished_weight_g').default(sql`null`),
    notes: text('notes').default(sql`null`),
    deletedAt: timestamp('deleted_at').default(sql`null`)
  },
  () => [check('recipe_servings_positive', sql`servings > 0`)]
)

export const recipeIngredients = appSchema.table('recipe_ingredients', {
  ...commonColumns,
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  foodId: integer('food_id')
    .notNull()
    .references(() => foods.id),
  foodServingId: integer('food_serving_id')
    .notNull()
    .references(() => foodServings.id),
  quantity: numeric('quantity').notNull(),
  unitLabel: varchar('unit_label', { length: 64 }).notNull(),
  gramsResolved: numeric('grams_resolved').default(sql`null`),
  sortOrder: integer('sort_order').notNull()
})

export const savedMeals = appSchema.table('saved_meals', {
  ...commonColumns,
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  deletedAt: timestamp('deleted_at').default(sql`null`)
})

export const savedMealItems = appSchema.table('saved_meal_items', {
  ...commonColumns,
  savedMealId: integer('saved_meal_id')
    .notNull()
    .references(() => savedMeals.id, { onDelete: 'cascade' }),
  foodId: integer('food_id')
    .notNull()
    .references(() => foods.id),
  foodServingId: integer('food_serving_id')
    .notNull()
    .references(() => foodServings.id),
  quantity: numeric('quantity').notNull(),
  unitLabel: varchar('unit_label', { length: 64 }).notNull(),
  gramsResolved: numeric('grams_resolved').default(sql`null`),
  sortOrder: integer('sort_order').notNull()
})
