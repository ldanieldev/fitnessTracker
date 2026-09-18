import { Meilisearch } from 'meilisearch'
import { and, eq, isNull } from 'drizzle-orm'
import { exercises } from '~~/server/db/schema'
import { db } from '../db'
import {
  EXERCISE_SEARCH_INDEX,
  EXERCISE_SEARCH_INDEX_SETTINGS,
  exerciseToSearchDocument,
  exerciseVisibilityFilter
} from './searchDocuments'
import type { ExerciseSearchCandidate, ExerciseSearchProvider } from './searchProvider'

export class ExerciseMeiliProvider implements ExerciseSearchProvider {
  private readonly client: Meilisearch
  private ready = false

  constructor(host: string, apiKey: string) {
    this.client = new Meilisearch({ host, apiKey: apiKey || undefined })
  }

  async ensureIndex(): Promise<void> {
    await this.client.createIndex(EXERCISE_SEARCH_INDEX, { primaryKey: 'id' }).catch(() => undefined)
    await this.client.index(EXERCISE_SEARCH_INDEX).updateSettings(EXERCISE_SEARCH_INDEX_SETTINGS)
  }

  async healthy(): Promise<boolean> {
    try {
      const health = await this.client.health()
      if (health.status !== 'available') return false
      // The index must exist before query()/index() can run against it, so create it the first time the probe succeeds.
      if (!this.ready) {
        await this.ensureIndex()
        this.ready = true
      }
      return true
    } catch {
      return false
    }
  }

  async isEmpty(): Promise<boolean> {
    try {
      const stats = await this.client.index(EXERCISE_SEARCH_INDEX).getStats()
      return stats.numberOfDocuments === 0
    } catch {
      // An unreadable index is "not known empty" — never trigger a rebuild storm off a transient stats failure.
      return false
    }
  }

  async query(userId: number, q: string, limit: number): Promise<ExerciseSearchCandidate[]> {
    const result = await this.client.index(EXERCISE_SEARCH_INDEX).search(q, {
      limit,
      filter: exerciseVisibilityFilter(userId),
      showRankingScore: true
    })
    return result.hits.map((hit) => ({ id: Number(hit.id), relevance: Number(hit._rankingScore ?? 0) }))
  }

  async index(exerciseId: number): Promise<void> {
    const doc = await loadSearchDocument(exerciseId)
    if (!doc) return this.delete(exerciseId)
    await this.client.index(EXERCISE_SEARCH_INDEX).addDocuments([doc])
  }

  async delete(exerciseId: number): Promise<void> {
    await this.client.index(EXERCISE_SEARCH_INDEX).deleteDocument(exerciseId)
  }

  async rebuild(): Promise<void> {
    await this.applyRebuild(false)
  }

  // Test fixtures need the index queryable immediately after rebuilding, unlike production's fire-and-forget rebuild.
  async rebuildAndWait(): Promise<void> {
    await this.applyRebuild(true)
  }

  private async applyRebuild(wait: boolean): Promise<void> {
    await this.ensureIndex()
    const rows = await db
      .select({ id: exercises.id, name: exercises.name, createdByUserId: exercises.createdByUserId })
      .from(exercises)
      .where(isNull(exercises.deletedAt))
    const docs = rows.map((row) => exerciseToSearchDocument(row))
    // Awaiting the delete enqueue before issuing the add enqueue guarantees Meilisearch orders them delete-then-add.
    const deleteTask = this.client.index(EXERCISE_SEARCH_INDEX).deleteAllDocuments()
    await deleteTask
    if (wait) await deleteTask.waitTask()
    if (docs.length) {
      const addTask = this.client.index(EXERCISE_SEARCH_INDEX).addDocuments(docs)
      await addTask
      if (wait) await addTask.waitTask()
    }
  }
}

async function loadSearchDocument(exerciseId: number) {
  const row = await db
    .select({ id: exercises.id, name: exercises.name, createdByUserId: exercises.createdByUserId })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), isNull(exercises.deletedAt)))
    .limit(1)
    .then((r) => r[0])
  return row ? exerciseToSearchDocument(row) : null
}
