import { logExport } from '~~/server/utils/export/exportLog'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { sessionFilterQuerySchema } from '~~/server/utils/workouts/input'
import { loadWorkoutCsvRows } from '~~/server/utils/workouts/sessionExport'
import { toWorkoutCsv } from '~~/shared/utils/workoutExport'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const filter = parseQuery(event, sessionFilterQuerySchema)
  const startedAt = performance.now()
  const rows = await loadWorkoutCsvRows(userId, filter)
  const csv = toWorkoutCsv(rows)
  logExport({
    userId,
    kind: 'sessions',
    ranged: Boolean(filter.from || filter.to),
    rows: rows.length,
    bytes: Buffer.byteLength(csv),
    startedAt
  })
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="workouts-${filter.from ?? 'start'}-to-${filter.to ?? 'latest'}.csv"`
  )
  return csv
})
