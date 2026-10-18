import { logExport } from '~~/server/utils/export/exportLog'
import { exportProgram } from '~~/server/utils/workouts/programTransfer'
import { idParamSchema } from '~~/server/utils/validation'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Program not found' })
  const startedAt = performance.now()
  const { filename, body } = await exportProgram(userId, id.data)
  const rows = body.routines.reduce((sum, r) => sum + r.days.reduce((n, day) => n + day.entries.length, 0), 0)
  logExport({ userId, kind: 'program', ranged: false, rows, programId: id.data, startedAt })
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  return body
})
