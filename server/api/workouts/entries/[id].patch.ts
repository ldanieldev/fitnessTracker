import { patchEntry } from '~~/server/utils/workouts/entries'
import { workoutEntryPatchSchema } from '~~/server/utils/workouts/input'
import { idParamSchema } from '~~/server/utils/validation'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
  const body = await parseBody(event, workoutEntryPatchSchema)
  return patchEntry(userId, id.data, body)
})
