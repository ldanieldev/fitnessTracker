import { deleteAccount } from '~~/server/utils/deleteAccount'
import { disconnectGoogleHealth } from '~~/server/utils/googleHealth/disconnect'
import { forbidToken, requireSessionUser } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  forbidToken(event)

  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id) || id === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })
  }

  if (sessionUser.id !== id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (event.context.sessionIsAdmin) {
    throw createError({ statusCode: 400, statusMessage: 'Move the admin role to another account first' })
  }

  await disconnectGoogleHealth(id)
  await deleteAccount(id)
  await clearUserSession(event)

  return { success: true }
})
