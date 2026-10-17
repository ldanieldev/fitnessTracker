import { and, eq } from 'drizzle-orm'
import { importJobs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const jobId = routeId(event, 'jobId')

  const job = await db
    .select({
      id: importJobs.id,
      status: importJobs.status,
      result: importJobs.result,
      error: importJobs.error,
      createdAt: importJobs.createdAt
    })
    .from(importJobs)
    .where(and(eq(importJobs.id, jobId), eq(importJobs.userId, userId), eq(importJobs.source, 'fitnotes')))
    .then((r) => r[0])
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Import job not found' })
  return job
})
