import { importJobs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { isMyMacrosHeader } from '~~/server/utils/nutrition/mymacros/parse'
import { queueImportJob } from '~~/server/utils/nutrition/mymacros/queue'
import { requireUserId } from '~~/server/utils/nutrition/session'

const MAX_FILES = 200
const MAX_FILE_BYTES = 64 * 1024
const MAX_TOTAL_BYTES = 2 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const parts = await readMultipartFormData(event)
  const files = (parts ?? []).filter((part) => part.name === 'files' && part.filename)

  if (files.length < 1 || files.length > MAX_FILES) {
    throw createError({ statusCode: 400, statusMessage: `Expected 1-${MAX_FILES} files, got ${files.length}` })
  }

  let totalBytes = 0
  for (const file of files) {
    if (!file.filename!.toLowerCase().endsWith('.txt') && !file.type?.startsWith('text/')) {
      throw createError({ statusCode: 400, statusMessage: `${file.filename} must be a .txt file` })
    }
    totalBytes += file.data.length
    if (file.data.length > MAX_FILE_BYTES) {
      throw createError({ statusCode: 400, statusMessage: `${file.filename} exceeds ${MAX_FILE_BYTES} bytes` })
    }
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw createError({ statusCode: 400, statusMessage: `Total upload exceeds ${MAX_TOTAL_BYTES} bytes` })
  }

  const decoded = files.map((file) => ({ name: file.filename!, text: file.data.toString('utf8') }))

  for (const file of decoded) {
    const firstLine = file.text.split('\n', 1)[0] ?? ''
    if (!isMyMacrosHeader(firstLine)) {
      throw createError({ statusCode: 400, statusMessage: `${file.name} is not a My Macros+ export`, data: { fileName: file.name } })
    }
  }

  const job = await db
    .insert(importJobs)
    .values({ userId, source: 'mymacros', status: 'queued', fileCount: decoded.length, payload: decoded })
    .returning({ id: importJobs.id })
    .then((r) => r[0]!)

  try {
    await queueImportJob(db, job.id, userId)
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
