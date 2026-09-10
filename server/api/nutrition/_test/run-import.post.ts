import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { importJobs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { runMyMacrosImport } from '~~/server/utils/nutrition/mymacros/run'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/nutrition/session'

const bodySchema = z.object({ jobId: z.number().int() })

export default defineEventHandler(async (event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const userId = await requireUserId(event)
  const body = await parseBody(event, bodySchema)

  const job = await db
    .select({ id: importJobs.id, userId: importJobs.userId })
    .from(importJobs)
    .where(eq(importJobs.id, body.jobId))
    .then((r) => r[0])
  if (!job || job.userId !== userId) throw createError({ statusCode: 404, statusMessage: 'Import job not found' })

  return runMyMacrosImport(db, body.jobId)
})
