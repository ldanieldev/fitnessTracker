import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { foodFavorites, foods, foodUsageStats } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { perDefaultByFood } from '~~/server/utils/nutrition/perDefault'
import { requireUserId } from '~~/server/utils/session'

const querySchema = z.object({ favorites: z.enum(['1']).optional() })

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const query = parseQuery(event, querySchema)

  const baseQuery = db
    .select({
      id: foods.id,
      name: foods.name,
      brand: foods.brand,
      isFavorite: sql<boolean>`${foodFavorites.userId} is not null`,
      logCount: foodUsageStats.logCount,
      lastLoggedAt: foodUsageStats.lastLoggedAt
    })
    .from(foods)
    .leftJoin(foodFavorites, and(eq(foodFavorites.foodId, foods.id), eq(foodFavorites.userId, userId)))
    .leftJoin(foodUsageStats, and(eq(foodUsageStats.foodId, foods.id), eq(foodUsageStats.userId, userId)))
    .where(
      and(
        isNull(foods.deletedAt),
        or(isNull(foods.createdByUserId), eq(foods.createdByUserId, userId)),
        query.favorites ? sql`${foodFavorites.userId} is not null` : isNull(foodUsageStats.hiddenAt)
      )
    )

  const rows = query.favorites
    ? await baseQuery.orderBy(asc(foods.name)).limit(50)
    : await baseQuery
        .orderBy(
          sql`(${foodFavorites.userId} is not null) desc`,
          sql`${foodUsageStats.logCount} desc nulls last`,
          sql`${foodUsageStats.lastLoggedAt} desc nulls last`,
          asc(foods.name)
        )
        .limit(50)

  const perDefaults = await perDefaultByFood(db, rows.map((row) => row.id))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    isFavorite: Boolean(row.isFavorite),
    logCount: Number(row.logCount ?? 0),
    lastLoggedAt: row.lastLoggedAt,
    perDefault: perDefaults.get(row.id) ?? null
  }))
})
