import { Meilisearch, type Settings } from 'meilisearch'

export interface MeiliCandidate {
  id: number
  relevance: number
}

export interface MeiliIndexConfig {
  name: string
  settings: Settings
  visibleTo: (userId: number) => string
}

export abstract class MeiliIndexProvider<TDoc extends { id: number }> {
  private readonly client: Meilisearch
  private readonly config: MeiliIndexConfig
  private ready = false

  protected constructor(host: string, apiKey: string, config: MeiliIndexConfig) {
    this.client = new Meilisearch({ host, apiKey: apiKey || undefined })
    this.config = config
  }

  protected abstract loadDocument(id: number): Promise<TDoc | null>
  protected abstract loadAllDocuments(): Promise<TDoc[]>

  async ensureIndex(): Promise<void> {
    await this.client.createIndex(this.config.name, { primaryKey: 'id' }).catch(() => undefined)
    await this.client.index(this.config.name).updateSettings(this.config.settings)
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
      const stats = await this.client.index(this.config.name).getStats()
      return stats.numberOfDocuments === 0
    } catch {
      // An unreadable index is "not known empty" — never trigger a rebuild storm off a transient stats failure.
      return false
    }
  }

  async query(userId: number, q: string, limit: number): Promise<MeiliCandidate[]> {
    const result = await this.client.index(this.config.name).search(q, {
      limit,
      filter: this.config.visibleTo(userId),
      showRankingScore: true
    })
    return result.hits.map((hit) => ({ id: Number(hit.id), relevance: Number(hit._rankingScore ?? 0) }))
  }

  async index(id: number): Promise<void> {
    const doc = await this.loadDocument(id)
    if (!doc) return this.delete(id)
    await this.client.index(this.config.name).addDocuments([doc])
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
      const addTask = this.client.index(this.config.name).addDocuments(docs)
      await addTask
      if (wait) await addTask.waitTask()
    }
  }
}
