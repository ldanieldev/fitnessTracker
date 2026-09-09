import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import { foodFavorites, foods, foodUsageStats } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const rows = await db
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
    .where(and(isNull(foods.deletedAt), or(isNull(foods.createdByUserId), eq(foods.createdByUserId, userId))))
    .orderBy(
      sql`(${foodFavorites.userId} is not null) desc`,
      sql`${foodUsageStats.logCount} desc nulls last`,
      sql`${foodUsageStats.lastLoggedAt} desc nulls last`,
      asc(foods.name)
    )
    .limit(50)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    isFavorite: Boolean(row.isFavorite),
    logCount: Number(row.logCount ?? 0),
    lastLoggedAt: row.lastLoggedAt
  }))
})
