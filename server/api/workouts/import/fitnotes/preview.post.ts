import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { fitNotesPreviewSchema } from '~~/server/utils/workouts/fitnotes/input'
import { parseFitNotesOr400 } from '~~/server/utils/workouts/fitnotes/parse'
import { previewFitNotes } from '~~/server/utils/workouts/fitnotes/preview'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { csv } = await parseBody(event, fitNotesPreviewSchema)
  return previewFitNotes(userId, parseFitNotesOr400(csv))
})
