import { db } from '../db'
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

export function getSearchProvider(): SearchProvider {
  return postgresSearchProvider
}

export function isDegradedProvider(provider: SearchProvider): boolean {
  return provider instanceof PostgresSearchProvider
}
