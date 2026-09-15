import { Meilisearch } from 'meilisearch'
import { and, eq, isNull } from 'drizzle-orm'
import { foodServings, foodSources, foods } from '~~/server/db/schema'
import { db } from '../db'
import { SEARCH_INDEX, SEARCH_INDEX_SETTINGS, foodToSearchDocument, visibilityFilter } from './searchDocuments'
import type { SearchCandidateRef, SearchProvider } from './searchProvider'

export class MeiliSearchProvider implements SearchProvider {
  private readonly client: Meilisearch
  private ready = false

  constructor(host: string, apiKey: string) {
    this.client = new Meilisearch({ host, apiKey: apiKey || undefined })
  }

  async ensureIndex(): Promise<void> {
    await this.client.createIndex(SEARCH_INDEX, { primaryKey: 'id' }).catch(() => undefined)
    await this.client.index(SEARCH_INDEX).updateSettings(SEARCH_INDEX_SETTINGS)
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
      const stats = await this.client.index(SEARCH_INDEX).getStats()
      return stats.numberOfDocuments === 0
    } catch {
      // An unreadable index is "not known empty" — never trigger a rebuild storm off a transient stats failure.
      return false
    }
  }

  async query(userId: number, q: string, limit: number): Promise<SearchCandidateRef[]> {
    const result = await this.client.index(SEARCH_INDEX).search(q, {
      limit,
      filter: visibilityFilter(userId),
      showRankingScore: true
    })
    return result.hits.map((hit) => ({ id: Number(hit.id), relevance: Number(hit._rankingScore ?? 0) }))
  }

  async index(foodId: number): Promise<void> {
    const doc = await loadSearchDocument(foodId)
    if (!doc) return this.delete(foodId)
    await this.client.index(SEARCH_INDEX).addDocuments([doc])
  }

  async delete(foodId: number): Promise<void> {
    await this.client.index(SEARCH_INDEX).deleteDocument(foodId)
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
    const rows = await db.select({ id: foods.id }).from(foods).where(isNull(foods.deletedAt))
    const docs = (await Promise.all(rows.map((r) => loadSearchDocument(r.id)))).filter((d) => d !== null)
    // Awaiting the delete enqueue before issuing the add enqueue guarantees Meilisearch orders them delete-then-add.
    const deleteTask = this.client.index(SEARCH_INDEX).deleteAllDocuments()
    await deleteTask
    if (wait) await deleteTask.waitTask()
    if (docs.length) {
      const addTask = this.client.index(SEARCH_INDEX).addDocuments(docs)
      await addTask
      if (wait) await addTask.waitTask()
    }
  }
}

async function loadSearchDocument(foodId: number) {
  const head = await db
    .select({
      id: foods.id, name: foods.name, brand: foods.brand, barcode: foods.barcode,
      createdByUserId: foods.createdByUserId, sourceKey: foodSources.key
    })
    .from(foods)
    .leftJoin(foodSources, eq(foodSources.id, foods.sourceId))
    .where(and(eq(foods.id, foodId), isNull(foods.deletedAt)))
    .limit(1)
    .then((r) => r[0])
  if (!head) return null
  const servings = await db
    .select({ label: foodServings.label, quantity: foodServings.quantity })
    .from(foodServings)
    .where(and(eq(foodServings.foodId, foodId), isNull(foodServings.deletedAt)))
  const labels = servings.map((s) => (Number(s.quantity) === 1 ? s.label : `${Number(s.quantity)} ${s.label}`))
  return foodToSearchDocument(head, labels, head.sourceKey ?? 'user')
}
