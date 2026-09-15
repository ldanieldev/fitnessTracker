import { sql } from 'drizzle-orm'
import { foodUsageStats } from '~~/server/db/schema'
import type { DbClient } from '../db'

export async function recordFoodUsage(tx: DbClient, userId: number, foodId: number) {
  await tx
    .insert(foodUsageStats)
    .values({ userId, foodId, logCount: 1, lastLoggedAt: new Date() })
    .onConflictDoUpdate({
      target: [foodUsageStats.userId, foodUsageStats.foodId],
      set: {
        logCount: sql`${foodUsageStats.logCount} + 1`,
        lastLoggedAt: sql`excluded.last_logged_at`,
        hiddenAt: null
      }
    })
}
