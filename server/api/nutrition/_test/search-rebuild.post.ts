import { MeiliSearchProvider } from '~~/server/utils/nutrition/meiliSearch'
import { getSearchProvider, isDegradedProvider } from '~~/server/utils/nutrition/searchProvider'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireUserId(event)
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const provider = await getSearchProvider()
  if (isDegradedProvider(provider)) return { skipped: true }
  if (provider instanceof MeiliSearchProvider) await provider.rebuildAndWait()
  else await provider.rebuild()
  return { skipped: false }
})
