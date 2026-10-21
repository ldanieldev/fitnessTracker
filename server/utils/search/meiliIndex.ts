import { Meilisearch, MeilisearchApiError, type Settings } from 'meilisearch'
import { logger } from '../logger'

const log = logger.child({ component: 'search' })

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

export interface MeiliProbe {
  healthy: boolean
  reason?: 'not_available' | 'index_rebuilding' | 'request_failed'
  err?: MeiliErrorSummary
}

export interface MeiliErrorSummary {
  type: string
  message: string
  errorCode?: string
  status?: number
  cause?: string
}

function isIndexNotFound(error: unknown): boolean {
  return error instanceof MeilisearchApiError && error.cause?.code === 'index_not_found'
}

// A Meilisearch timeout's cause carries the request body (search text, documents); keep only names, codes, messages.
export function meiliErrorSummary(error: unknown): MeiliErrorSummary {
  if (!(error instanceof Error)) return { type: typeof error, message: String(error) }
  const summary: MeiliErrorSummary = { type: error.name, message: error.message }
  if (error instanceof MeilisearchApiError) {
    if (error.cause?.code) summary.errorCode = error.cause.code
    if (error.response) summary.status = error.response.status
  } else if (error.cause instanceof Error) {
    summary.cause = `${error.cause.name}: ${error.cause.message}`
  }
  return summary
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
    try {
      const task = await this.client.createIndex(this.config.name, { primaryKey: 'id' }).waitTask()
      const errorCode = task.error?.code
      if (task.status === 'failed' && errorCode !== 'index_already_exists') {
        log.warn({ index: this.config.name, errorCode }, 'search index create task failed')
      }
    } catch (error) {
      if (!(error instanceof MeilisearchApiError && error.cause?.code === 'index_already_exists')) {
        log.warn({ index: this.config.name, err: meiliErrorSummary(error) }, 'search index create request failed')
      }
    }
    await this.client.index(this.config.name).updateSettings(this.config.settings)
  }

  async healthy(): Promise<boolean> {
    return (await this.probe()).healthy
  }

  async probe(): Promise<MeiliProbe> {
    try {
      const health = await this.reads.health()
      if (health.status !== 'available') return { healthy: false, reason: 'not_available' }
      return (await this.checkIndex()) ? { healthy: true } : { healthy: false, reason: 'index_rebuilding' }
    } catch (error) {
      return { healthy: false, reason: 'request_failed', err: meiliErrorSummary(error) }
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
      if (!(await this.needsRebuild())) return true
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
      const reason = missing ? 'missing' : 'replaced_empty'
      log.info({ index: this.config.name, reason }, 'search index recovered by rebuild')
    } catch (error) {
      log.warn({ index: this.config.name, err: meiliErrorSummary(error) }, 'search index recovery failed')
    }
  }

  // An empty index is correct while its table is empty; rebuilding it then only re-empties it, every drain.
  async needsRebuild(): Promise<boolean> {
    if (!(await this.isEmpty())) return false
    return (await this.loadAllDocuments()).length > 0
  }

  async isEmpty(): Promise<boolean> {
    try {
      const stats = await this.reads.index(this.config.name).getStats()
      if (stats.numberOfDocuments > 0) return false
      // A queued rebuild reads as 0 docs until its add runs, so pending tasks veto "empty" to stop repeat rebuilds.
      const pending = await this.reads.tasks.getTasks({
        indexUids: [this.config.name],
        statuses: ['enqueued', 'processing'],
        types: ['documentDeletion', 'documentAdditionOrUpdate'],
        limit: 1
      })
      return pending.total === 0
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
    const started = performance.now()
    await this.ensureIndex()
    const docs = await this.loadAllDocuments()
    // Awaiting the delete enqueue before issuing the add enqueue guarantees Meilisearch orders them delete-then-add.
    const deleteTask = this.client.index(this.config.name).deleteAllDocuments()
    const deleteTaskUid = (await deleteTask).taskUid
    if (wait) await deleteTask.waitTask()
    let addTaskUid: number | undefined
    if (docs.length) {
      const addTask = this.client.index(this.config.name).addDocuments(docs, { primaryKey: 'id' })
      addTaskUid = (await addTask).taskUid
      if (wait) await addTask.waitTask()
    }
    log.info(
      {
        index: this.config.name,
        docs: docs.length,
        deleteTaskUid,
        addTaskUid,
        durationMs: Math.round(performance.now() - started)
      },
      'search index rebuild enqueued'
    )
  }
}
