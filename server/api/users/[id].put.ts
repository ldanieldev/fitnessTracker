import { eq, getTableColumns } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '~~/server/db/schema'

const updateProfileSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  age: z.coerce.number().min(13).max(120),
  sex: z.enum(['m', 'f']).optional(),
  avatarUrl: z.string().url().optional().or(z.literal(''))
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id) || id === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })
  }

  if (session.user.id !== id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const parsed = updateProfileSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: z.flattenError(parsed.error)
    })
  }

  // Check email uniqueness if changed
  if (parsed.data.email !== session.user.email) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1)
      .then((r) => r[0])

    if (existing) {
      throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
    }
  }

  const { password, ...userColumns } = getTableColumns(users)

  const user = await db
    .update(users)
    .set({
      name: parsed.data.name,
      email: parsed.data.email,
      age: parsed.data.age,
      sex: parsed.data.sex,
      avatarUrl: parsed.data.avatarUrl || null
    })
    .where(eq(users.id, id))
    .returning(userColumns)
    .then((r) => r[0]!)

  // Update session with new data
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatarUrl,
      age: user.age,
      sex: user.sex
    }
  })

  return user
})
