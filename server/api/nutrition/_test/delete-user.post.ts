import { deleteAccount } from '~~/server/utils/deleteAccount'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const userId = await requireUserId(event)

  await deleteAccount(userId)

  return { success: true }
})
