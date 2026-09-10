import { db } from '../db'
import { MeiliSearchProvider } from './meiliSearch'
import { queryFoodCandidates } from './postgresSearch'

export interface SearchCandidateRef {
  id: number
  relevance: number
}

export interface SearchProvider {
  query(userId: number, q: string, limit: number): Promise<SearchCandidateRef[]>
  index(foodId: number): Promise<void>
  delete(foodId: number): Promise<void>
  rebuild(): Promise<void>
}

class PostgresSearchProvider implements SearchProvider {
  async query(userId: number, q: string, limit: number): Promise<SearchCandidateRef[]> {
    return queryFoodCandidates(db, userId, q, limit)
  }

  async index(_foodId: number): Promise<void> {}

  async delete(_foodId: number): Promise<void> {}

  async rebuild(): Promise<void> {}
}

const postgresSearchProvider = new PostgresSearchProvider()

let meili: MeiliSearchProvider | null = null
let meiliHealthyUntil = 0

export async function getSearchProvider(): Promise<SearchProvider> {
  const { host, apiKey } = useRuntimeConfig().meili
  if (!host) return postgresSearchProvider
  meili ??= new MeiliSearchProvider(host, apiKey)
  const now = Date.now()
  if (now < meiliHealthyUntil) return meili
  if (await meili.healthy()) {
    // Re-probe every 30 s so a Meilisearch outage degrades within half a minute, not per request.
    meiliHealthyUntil = now + 30_000
    return meili
  }
  meiliHealthyUntil = 0
  return postgresSearchProvider
}

export function isDegradedProvider(provider: SearchProvider): boolean {
  return provider instanceof PostgresSearchProvider
}

export function getFallbackProvider(): SearchProvider {
  return postgresSearchProvider
}

export function markSearchUnhealthy(): void {
  meiliHealthyUntil = 0
}
