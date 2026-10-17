import { Meilisearch, MeilisearchApiError, type Settings } from 'meilisearch'
import { logger } from '../logger'

export interface MeiliCandidate {
  id: number
  relevance: number
}

export interface MeiliIndexConfig {
  name: string
  settings: Settings
  visibleTo: (userId: number) => string
}

// Per read request, so a hung Meilisearch fails a search in time for the fallback; bulk document writes get longer.
export const MEILI_TIMEOUT_MS = 1500
export const MEILI_WRITE_TIMEOUT_MS = 30_000

function isIndexNotFound(error: unknown): boolean {
  return error instanceof MeilisearchApiError && error.cause?.code === 'index_not_found'
}

export abstract class MeiliIndexProvider<TDoc extends { id: number }> {
  private readonly client: Meilisearch
  private readonly reads: Meilisearch
  private readonly config: MeiliIndexConfig
  private knownCreatedAt: string | null = null
  private recovering: Promise<void> | null = null

  protected constructor(host: string, apiKey: string, config: MeiliIndexConfig) {
    this.client = new Meilisearch({ host, apiKey: apiKey || undefined, timeout: MEILI_WRITE_TIMEOUT_MS })
    this.reads = new Meilisearch({ host, apiKey: apiKey || undefined, timeout: MEILI_TIMEOUT_MS })
    this.config = config
  }

  protected abstract loadDocument(id: number): Promise<TDoc | null>
  protected abstract loadAllDocuments(): Promise<TDoc[]>

  async ensureIndex(): Promise<void> {
    await this.client
      .createIndex(this.config.name, { primaryKey: 'id' })
      .waitTask()
      .catch(() => undefined)
    await this.client.index(this.config.name).updateSettings(this.config.settings)
  }

  async healthy(): Promise<boolean> {
    try {
      const health = await this.reads.health()
      if (health.status !== 'available') return false
      return await this.checkIndex()
    } catch {
      return false
    }
  }

  private async currentCreatedAt(): Promise<string | null> {
    try {
      return String((await this.reads.getRawIndex(this.config.name)).createdAt)
    } catch (error) {
      if (isIndexNotFound(error)) return null
      throw error
    }
  }

  // Never deletes an existing index, so processes sharing one Meilisearch adopt each other's recreated index.
  private async checkIndex(): Promise<boolean> {
    if (this.recovering) return false
    const createdAt = await this.currentCreatedAt()
    if (createdAt !== null && createdAt === this.knownCreatedAt) return true
    if (createdAt !== null) {
      await this.ensureIndex()
      this.knownCreatedAt = createdAt
      if (!(await this.isEmpty())) return true
    }
    this.recovering = this.recover(createdAt === null).finally(() => {
      this.recovering = null
    })
    return false
  }

  private async recover(missing: boolean): Promise<void> {
    try {
      await this.applyRebuild(false)
      this.knownCreatedAt = await this.currentCreatedAt()
      const reason = missing ? 'was missing; recreated' : 'was replaced empty'
      logger.info({ index: this.config.name }, `search index ${reason} and rebuilding`)
    } catch (err) {
      logger.warn({ err, index: this.config.name }, 'search index recovery failed')
    }
  }

  async isEmpty(): Promise<boolean> {
    try {
      const stats = await this.reads.index(this.config.name).getStats()
      return stats.numberOfDocuments === 0
    } catch (error) {
      // A missing index is empty; any other read failure is "not known empty", so a blip never storms rebuilds.
      return isIndexNotFound(error)
    }
  }

  async query(userId: number, q: string, limit: number): Promise<MeiliCandidate[]> {
    const result = await this.reads.index(this.config.name).search(q, {
      limit,
      filter: this.config.visibleTo(userId),
      showRankingScore: true
    })
    return result.hits.map((hit) => ({ id: Number(hit.id), relevance: Number(hit._rankingScore ?? 0) }))
  }

  async index(id: number): Promise<void> {
    const doc = await this.loadDocument(id)
    if (!doc) return this.delete(id)
    await this.client.index(this.config.name).addDocuments([doc], { primaryKey: 'id' })
  }

  async delete(id: number): Promise<void> {
    await this.client.index(this.config.name).deleteDocument(id)
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
    const docs = await this.loadAllDocuments()
    // Awaiting the delete enqueue before issuing the add enqueue guarantees Meilisearch orders them delete-then-add.
    const deleteTask = this.client.index(this.config.name).deleteAllDocuments()
    await deleteTask
    if (wait) await deleteTask.waitTask()
    if (docs.length) {
      const addTask = this.client.index(this.config.name).addDocuments(docs, { primaryKey: 'id' })
      await addTask
      if (wait) await addTask.waitTask()
    }
  }
}
