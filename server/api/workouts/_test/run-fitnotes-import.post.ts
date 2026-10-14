import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { importJobs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { runFitNotesImport } from '~~/server/utils/workouts/fitnotes/run'

const bodySchema = z.object({ jobId: z.number().int() })

export default defineEventHandler(async (event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const userId = await requireUserId(event)
  const { jobId } = await parseBody(event, bodySchema)
  const job = await db
    .select({ id: importJobs.id })
    .from(importJobs)
    .where(and(eq(importJobs.id, jobId), eq(importJobs.userId, userId), eq(importJobs.source, 'fitnotes')))
    .then((r) => r[0])
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Import job not found' })
  return runFitNotesImport(jobId)
})
