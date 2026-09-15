import { and, eq } from 'drizzle-orm'
import { importJobs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const jobId = Number(getRouterParam(event, 'jobId'))
  if (!Number.isInteger(jobId) || jobId <= 0) throw createError({ statusCode: 404, statusMessage: 'Import job not found' })

  const job = await db
    .select({
      id: importJobs.id,
      status: importJobs.status,
      fileCount: importJobs.fileCount,
      result: importJobs.result,
      error: importJobs.error,
      createdAt: importJobs.createdAt
    })
    .from(importJobs)
    .where(and(eq(importJobs.id, jobId), eq(importJobs.userId, userId)))
    .then((r) => r[0])
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Import job not found' })

  return job
})
