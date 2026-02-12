import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '~~/server/db/schema'

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: z.flattenError(parsed.error)
    })
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1)
    .then((r) => r[0])

  if (!user || !user.password) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password'
    })
  }

  const valid = await verifyPassword(user.password, parsed.data.password)

  if (!valid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password'
    })
  }

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

  return { success: true }
})
