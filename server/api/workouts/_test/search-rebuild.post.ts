import { ExerciseMeiliProvider } from '~~/server/utils/workouts/meiliSearch'
import { getExerciseSearchProvider, isDegradedExerciseProvider } from '~~/server/utils/workouts/searchProvider'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireUserId(event)
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const provider = await getExerciseSearchProvider()
  if (isDegradedExerciseProvider(provider)) return { skipped: true }
  if (provider instanceof ExerciseMeiliProvider) await provider.rebuildAndWait()
  else await provider.rebuild()
  return { skipped: false }
})
