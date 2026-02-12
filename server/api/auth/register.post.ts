import { eq, getTableColumns } from 'drizzle-orm'
import { z } from 'zod'
import { users, authProviders } from '~~/server/db/schema'

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  age: z.coerce.number().min(13).max(120),
  sex: z.enum(['m', 'f']).optional()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: z.flattenError(parsed.error)
    })
  }

  const { password, ...userColumns } = getTableColumns(users)

  // Check if email already exists
  const existing = await db
    .select({ id: users.id, password: users.password })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1)
    .then((r) => r[0])

  if (existing) {
    // If user exists from OAuth but has no password, let them set one (account linking)
    if (!existing.password) {
      const hashedPassword = await hashPassword(parsed.data.password)
      await db
        .update(users)
        .set({
          password: hashedPassword,
          name: parsed.data.name,
          age: parsed.data.age,
          sex: parsed.data.sex
        })
        .where(eq(users.id, existing.id))

      await db.insert(authProviders).values({
        userId: existing.id,
        provider: 'credentials',
        providerAccountId: parsed.data.email
      })

      const user = await db
        .select(userColumns)
        .from(users)
        .where(eq(users.id, existing.id))
        .limit(1)
        .then((r) => r[0]!)

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
    }

    throw createError({ statusCode: 409, statusMessage: 'Email already exists' })
  }

  // Create new user with credentials
  const hashedPassword = await hashPassword(parsed.data.password)

  const user = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      age: parsed.data.age,
      sex: parsed.data.sex,
      isActive: true
    })
    .returning(userColumns)
    .then((r) => r[0]!)

  // Link credentials provider
  await db.insert(authProviders).values({
    userId: user.id,
    provider: 'credentials',
    providerAccountId: parsed.data.email
  })

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
