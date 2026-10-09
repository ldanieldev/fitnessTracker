import { importProgram } from '~~/server/utils/workouts/programTransfer'
import { programExportSchema } from '~~/shared/utils/programExport'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, programExportSchema)
  return importProgram(userId, body)
})
