import { eq } from 'drizzle-orm'
import { importJobs } from '~~/server/db/schema'
import type { RootDbClient } from '../../db'
import { inngest } from '../../inngest/client'
import { logger } from '../../logger'

export async function queueImportJob(db: RootDbClient, jobId: number, userId: number): Promise<void> {
  try {
    await inngest.send({ name: 'import/mymacros.requested', data: { jobId, userId } })
  } catch (err) {
    logger.error({ err, jobId, userId, source: 'mymacros', sentryCaptured: true }, 'import job not queued')
    const message = err instanceof Error ? err.message : String(err)
    try {
      await db
        .update(importJobs)
        .set({ status: 'failed', error: `Could not queue the import job: ${message}`, payload: {} })
        .where(eq(importJobs.id, jobId))
    } catch (updateErr) {
      logger.error({ err: updateErr, jobId, userId, source: 'mymacros' }, 'unqueued import job not marked failed')
    }
    throw err
  }
}
