import { eq } from 'drizzle-orm'
import { importJobs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { inngest } from '~~/server/utils/inngest/client'
import { logger } from '~~/server/utils/logger'

export async function queueFitNotesImport(jobId: number, userId: number): Promise<void> {
  try {
    await inngest.send({ name: 'import/fitnotes.requested', data: { jobId, userId } })
  } catch (err) {
    logger.error({ err, jobId, userId, source: 'fitnotes', sentryCaptured: true }, 'import job not queued')
    const message = err instanceof Error ? err.message : String(err)
    try {
      await db
        .update(importJobs)
        .set({ status: 'failed', error: `Could not queue the import job: ${message}`, payload: {} })
        .where(eq(importJobs.id, jobId))
    } catch (updateErr) {
      logger.error({ err: updateErr, jobId, userId, source: 'fitnotes' }, 'unqueued import job not marked failed')
    }
    throw err
  }
}
