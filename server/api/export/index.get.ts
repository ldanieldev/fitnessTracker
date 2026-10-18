import { buildAccountExport } from '~~/server/utils/export/account'
import { logExport } from '~~/server/utils/export/exportLog'
import { exportFilename, exportQuerySchema } from '~~/server/utils/export/range'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { today, from, to } = parseQuery(event, exportQuerySchema)
  const startedAt = performance.now()
  const data = await buildAccountExport(userId, { from, to })
  const rows = Object.values(data.tables).reduce((sum, table) => sum + table.length, 0)
  logExport({ userId, kind: 'account', ranged: Boolean(from || to), rows, startedAt })
  const date = today ?? data.exportedAt.slice(0, 10)
  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${exportFilename(date, { from, to })}"`)
  return data
})
