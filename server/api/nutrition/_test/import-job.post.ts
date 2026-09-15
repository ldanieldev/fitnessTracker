import { z } from 'zod'
import { importJobs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

const bodySchema = z.object({
  files: z.array(z.object({ name: z.string().min(1), text: z.string() })).min(1)
})

export default defineEventHandler(async (event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const userId = await requireUserId(event)
  const body = await parseBody(event, bodySchema)

  const job = await db
    .insert(importJobs)
    .values({ userId, source: 'mymacros', fileCount: body.files.length, payload: body.files })
    .returning({ id: importJobs.id })
    .then((r) => r[0]!)

  return { jobId: job.id }
})
