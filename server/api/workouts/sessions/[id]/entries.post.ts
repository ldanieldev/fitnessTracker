import { addEntry } from '~~/server/utils/workouts/entries'
import { idParamSchema, workoutEntryAddSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 404, statusMessage: 'Workout not found' })
  const body = await parseBody(event, workoutEntryAddSchema)
  return addEntry(userId, id.data, body.exerciseId)
})
