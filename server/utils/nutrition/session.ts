import type { H3Event } from 'h3'

export async function requireUserId(event: H3Event): Promise<number> {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session.user.id
}
