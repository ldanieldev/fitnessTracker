import { importJobs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { loadVisibleExerciseRow } from '~~/server/utils/workouts/exercises'
import { fitNotesImportSchema } from '~~/server/utils/workouts/fitnotes/input'
import { parseFitNotesOr400 } from '~~/server/utils/workouts/fitnotes/parse'
import { queueFitNotesImport } from '~~/server/utils/workouts/fitnotes/queue'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, fitNotesImportSchema)
  const names = new Set(parseFitNotesOr400(body.csv).map((r) => r.exercise))

  const mapping: Record<string, number | null> = {}
  for (const [name, exerciseId] of Object.entries(body.mapping)) {
    if (!names.has(name)) throw createError({ statusCode: 400, statusMessage: `"${name}" is not in this export` })
    if (exerciseId !== null) await loadVisibleExerciseRow(userId, exerciseId)
    mapping[name] = exerciseId
  }

  const job = await db
    .insert(importJobs)
    .values({
      userId,
      source: 'fitnotes',
      status: 'queued',
      fileCount: 1,
      payload: { csv: body.csv, mapping, skipExistingDays: body.skipExistingDays }
    })
    .returning({ id: importJobs.id })
    .then((r) => r[0]!)

  try {
    await queueFitNotesImport(job.id, userId)
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'Import job runner unreachable; the job was marked failed',
      data: { jobId: job.id }
    })
  }

  setResponseStatus(event, 201)
  return { jobId: job.id }
})
