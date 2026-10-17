import { eq } from 'drizzle-orm'
import { importJobs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { inngest } from '~~/server/utils/inngest/client'

export async function queueFitNotesImport(jobId: number, userId: number): Promise<void> {
  try {
    await inngest.send({ name: 'import/fitnotes.requested', data: { jobId, userId } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(importJobs)
      .set({ status: 'failed', error: `Could not queue the import job: ${message}`, payload: {} })
      .where(eq(importJobs.id, jobId))
    throw err
  }
}
