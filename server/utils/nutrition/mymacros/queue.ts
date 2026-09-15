import { eq } from 'drizzle-orm'
import { importJobs } from '~~/server/db/schema'
import type { RootDbClient } from '../../db'
import { inngest } from '../../inngest/client'

export async function queueImportJob(db: RootDbClient, jobId: number, userId: number): Promise<void> {
  try {
    await inngest.send({ name: 'import/mymacros.requested', data: { jobId, userId } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.update(importJobs).set({ status: 'failed', error: `Could not queue the import job: ${message}` }).where(eq(importJobs.id, jobId))
    throw err
  }
}
