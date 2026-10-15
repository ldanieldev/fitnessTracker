import { buildAccountExport } from '~~/server/utils/export/account'
import { exportFilename, exportQuerySchema } from '~~/server/utils/export/range'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { today, from, to } = parseQuery(event, exportQuerySchema)
  const data = await buildAccountExport(userId, { from, to })
  const date = today ?? data.exportedAt.slice(0, 10)
  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${exportFilename(date, { from, to })}"`)
  return data
})
