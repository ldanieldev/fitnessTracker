import { meiliErrorSummary } from '../search/meiliIndex'
import { createSearchHealthTracker } from '../search/searchHealth'
import { ExerciseMeiliProvider } from './meiliSearch'
import { EXERCISE_SEARCH_INDEX } from './searchDocuments'

export interface ExerciseSearchCandidate {
  id: number
  relevance: number
}

export interface ExerciseSearchProvider {
  query(userId: number, q: string, limit: number): Promise<ExerciseSearchCandidate[]>
  index(exerciseId: number): Promise<void>
  delete(exerciseId: number): Promise<void>
  rebuild(): Promise<void>
}

// No Postgres fallback: the in-memory matcher is the primary search and Meilisearch only rescues typos it cannot match.
class DegradedExerciseProvider implements ExerciseSearchProvider {
  async query(_userId: number, _q: string, _limit: number): Promise<ExerciseSearchCandidate[]> {
    return []
  }

  async index(_exerciseId: number): Promise<void> {}

  async delete(_exerciseId: number): Promise<void> {}

  async rebuild(): Promise<void> {}
}

const degradedProvider = new DegradedExerciseProvider()

const PROBE_TTL_MS = 30_000

let meili: ExerciseMeiliProvider | null = null
let meiliHealthyUntil = 0
let meiliUnhealthyUntil = 0
const health = createSearchHealthTracker(
  EXERCISE_SEARCH_INDEX,
  'Meilisearch unhealthy; exercise typo rescue is off'
)

export async function getExerciseSearchProvider(): Promise<ExerciseSearchProvider> {
  const { host, apiKey } = useRuntimeConfig().meili
  if (!host) return degradedProvider
  meili ??= new ExerciseMeiliProvider(host, apiKey)
  const now = Date.now()
  if (now < meiliHealthyUntil) return meili
  if (now < meiliUnhealthyUntil) return degradedProvider
  // Either verdict holds 30 s: an outage degrades within half a minute, and a down server is not probed per request.
  const probe = await meili.probe()
  if (probe.healthy) {
    meiliHealthyUntil = now + PROBE_TTL_MS
    health.up()
    return meili
  }
  meiliHealthyUntil = 0
  meiliUnhealthyUntil = now + PROBE_TTL_MS
  health.down(probe.reason ?? 'unknown', probe.err)
  return degradedProvider
}

export function isDegradedExerciseProvider(provider: ExerciseSearchProvider): boolean {
  return provider instanceof DegradedExerciseProvider
}

export function markExerciseSearchUnhealthy(error?: unknown): void {
  meiliHealthyUntil = 0
  meiliUnhealthyUntil = Date.now() + PROBE_TTL_MS
  health.down('query_failed', error === undefined ? undefined : meiliErrorSummary(error))
}
