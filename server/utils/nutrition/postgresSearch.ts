import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { foods } from '~~/server/db/schema'
import type { DbClient } from '~~/server/utils/db'

export interface FoodCandidateRef {
  id: number
  relevance: number
}

const CANDIDATE_POOL_LIMIT = 100

export function escapeLike(q: string): string {
  return q.replace(/\\/g, '\\\\').replace(/[%_]/g, (m) => `\\${m}`)
}

export async function queryFoodCandidates(
  client: DbClient,
  userId: number,
  q: string,
  limit = CANDIDATE_POOL_LIMIT
): Promise<FoodCandidateRef[]> {
  const escaped = escapeLike(q)
  const prefixPattern = `${escaped}%`
  const containsPattern = `%${escaped}%`

  const rows = await client
    .select({
      id: foods.id,
      relevance: sql<number>`case when ${foods.name} ilike ${prefixPattern} escape '\\' then 1 else 0.5 end`
    })
    .from(foods)
    .where(
      and(
        isNull(foods.deletedAt),
        or(isNull(foods.createdByUserId), eq(foods.createdByUserId, userId)),
        sql`${foods.name} ilike ${containsPattern} escape '\\'`
      )
    )
    .orderBy(
      sql`case when ${foods.name} ilike ${prefixPattern} escape '\\' then 1 else 0.5 end desc`,
      foods.name
    )
    .limit(Math.min(limit, CANDIDATE_POOL_LIMIT))

  return rows.map((r) => ({ id: r.id, relevance: Number(r.relevance) }))
}
