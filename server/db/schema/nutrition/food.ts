import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'
import { appSchema, commonColumns } from '../../shared'
import { users } from '../users'
import { nutrients } from './nutrient'

export const foodSources = appSchema.table(
  'food_sources',
  {
    ...commonColumns,
    key: varchar('key', { enum: ['off', 'usda', 'fatsecret', 'user'] }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    licenseNotice: text('license_notice').default(sql`null`),
    attributionRequired: boolean('attribution_required').notNull().default(false),
    persistable: boolean('persistable').notNull().default(true)
  },
  (table) => [uniqueIndex('food_source_key_unique').on(table.key)]
)

export const foods = appSchema.table(
  'foods',
  {
    ...commonColumns,
    name: varchar('name', { length: 255 }).notNull(),
    brand: varchar('brand', { length: 255 }).default(sql`null`),
    createdByUserId: integer('created_by_user_id')
      .default(sql`null`)
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceId: integer('source_id')
      .default(sql`null`)
      .references(() => foodSources.id),
    externalId: varchar('external_id', { length: 255 }).default(sql`null`),
    barcode: varchar('barcode', { length: 64 }).default(sql`null`),
    forkedFromFoodId: integer('forked_from_food_id')
      .default(sql`null`)
      .references((): AnyPgColumn => foods.id),
    isVerified: boolean('is_verified').notNull().default(false),
    deletedAt: timestamp('deleted_at').default(sql`null`)
  },
  (table) => [
    uniqueIndex('food_catalog_barcode_unique')
      .on(table.barcode)
      .where(sql`created_by_user_id is null and deleted_at is null`),
    index('food_owner_live').on(table.createdByUserId, table.deletedAt)
  ]
)

export const foodServings = appSchema.table(
  'food_servings',
  {
    ...commonColumns,
    foodId: integer('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { enum: ['weight', 'named'] }).notNull(),
    label: varchar('label', { length: 64 }).notNull(),
    quantity: numeric('quantity').notNull().default('1'),
    basisGrams: numeric('basis_grams').default(sql`null`),
    hasOwnNutrition: boolean('has_own_nutrition').notNull(),
    origin: varchar('origin', { enum: ['import', 'user'] }).notNull(),
    userModified: boolean('user_modified').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    deletedAt: timestamp('deleted_at').default(sql`null`)
  },
  (table) => [
    uniqueIndex('food_one_weight_serving')
      .on(table.foodId)
      .where(sql`kind = 'weight' and deleted_at is null`),
    check('serving_has_basis', sql`has_own_nutrition or basis_grams is not null`),
    check(
      'weight_serving_owns_nutrition',
      sql`kind <> 'weight' or (basis_grams is not null and has_own_nutrition)`
    ),
    check('serving_quantity_positive', sql`quantity > 0`),
    check('serving_basis_grams_positive', sql`basis_grams is null or basis_grams > 0`)
  ]
)

export const foodNutrients = appSchema.table(
  'food_nutrients',
  {
    foodServingId: integer('food_serving_id')
      .notNull()
      .references(() => foodServings.id, { onDelete: 'cascade' }),
    nutrientId: integer('nutrient_id')
      .notNull()
      .references(() => nutrients.id),
    amount: numeric('amount').notNull()
  },
  (table) => [primaryKey({ columns: [table.foodServingId, table.nutrientId] })]
)

export const foodFavorites = appSchema.table(
  'food_favorites',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    foodId: integer('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' })
  },
  (table) => [primaryKey({ columns: [table.userId, table.foodId] })]
)

export const foodUsageStats = appSchema.table(
  'food_usage_stats',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    foodId: integer('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    logCount: integer('log_count').notNull().default(0),
    lastLoggedAt: timestamp('last_logged_at').notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.foodId] })]
)
