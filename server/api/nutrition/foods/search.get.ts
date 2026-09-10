import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { foodFavorites, foodNutrients, foods, foodServings, foodUsageStats } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { getNutrientId } from '~~/server/utils/nutrition/nutrientIds'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import {
  getFallbackProvider,
  getSearchProvider,
  isDegradedProvider,
  markSearchUnhealthy,
  type SearchCandidateRef
} from '~~/server/utils/nutrition/searchProvider'
import { rerank, type SearchCandidate } from '~~/server/utils/nutrition/searchRank'
import { requireUserId } from '~~/server/utils/nutrition/session'
import { energyDensity } from '~~/shared/utils/nutritionDerive'

const CANDIDATE_POOL_LIMIT = 100

const searchQuerySchema = z.object({
  q: z.string().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(25)
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const query = parseQuery(event, searchQuerySchema)

  let provider = await getSearchProvider()
  const q = query.q.trim()

  if (!q) return { hits: [], degraded: isDegradedProvider(provider) }

  let refs: SearchCandidateRef[]
  try {
    refs = await provider.query(userId, q, CANDIDATE_POOL_LIMIT)
  } catch {
    markSearchUnhealthy()
    provider = getFallbackProvider()
    refs = await provider.query(userId, q, CANDIDATE_POOL_LIMIT)
  }
  const degraded = isDegradedProvider(provider)
  if (refs.length === 0) return { hits: [], degraded }

  const ids = refs.map((ref) => ref.id)
  const rows = await db
    .select({
      id: foods.id,
      name: foods.name,
      brand: foods.brand,
      isFavorite: sql<boolean>`${foodFavorites.userId} is not null`,
      logCount: foodUsageStats.logCount
    })
    .from(foods)
    .leftJoin(foodFavorites, and(eq(foodFavorites.foodId, foods.id), eq(foodFavorites.userId, userId)))
    .leftJoin(foodUsageStats, and(eq(foodUsageStats.foodId, foods.id), eq(foodUsageStats.userId, userId)))
    .where(inArray(foods.id, ids))

  const energyNutrientId = await getNutrientId('energy')
  const densityRows = await db
    .select({
      foodId: foodServings.foodId,
      basisGrams: foodServings.basisGrams,
      energy: foodNutrients.amount
    })
    .from(foodServings)
    .leftJoin(
      foodNutrients,
      and(eq(foodNutrients.foodServingId, foodServings.id), eq(foodNutrients.nutrientId, energyNutrientId))
    )
    .where(and(inArray(foodServings.foodId, ids), eq(foodServings.kind, 'weight'), isNull(foodServings.deletedAt)))

  const densityByFood = new Map(
    densityRows.map((row) => {
      const energy = row.energy === null ? null : Number(row.energy)
      const basisGrams = row.basisGrams === null ? null : Number(row.basisGrams)
      return [row.foodId, energyDensity(energy, basisGrams)] as const
    })
  )

  const rowById = new Map(rows.map((row) => [row.id, row]))
  const favorites = new Set(rows.filter((row) => row.isFavorite).map((row) => row.id))
  const usage = new Map(rows.filter((row) => row.logCount).map((row) => [row.id, Number(row.logCount)]))

  const candidates: SearchCandidate[] = refs.flatMap((ref) => {
    const row = rowById.get(ref.id)
    if (!row) return []
    return [{ id: row.id, name: row.name, relevance: ref.relevance }]
  })

  const hits = rerank(candidates, { favorites, usage })
    .slice(0, query.limit)
    .map((hit) => ({ ...hit, brand: rowById.get(hit.id)!.brand, energyDensity: densityByFood.get(hit.id) ?? null }))

  return { hits, degraded }
})
