import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users, authProviders } from '~~/server/db/schema'
import { emailSchema } from '~~/shared/utils/email'
import { seedContainersForUser } from '~~/server/db/seed/nutrition'
import { insertUser } from '~~/server/utils/insertUser'
import { writeSession } from '~~/server/utils/session'
import { toSessionUser } from '~~/server/utils/sessionUser'

const registerSchema = z.object({
  name: z.string().min(1),
  email: emailSchema,
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

  // Check if email already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1)
    .then((r) => r[0])

  // Never set a password on an existing OAuth-only account here: knowing its email would be enough to take it over.
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Email already exists' })

  // Create new user with credentials
  const hashedPassword = await hashPassword(parsed.data.password)

  const user = await insertUser({
    name: parsed.data.name,
    email: parsed.data.email,
    password: hashedPassword,
    age: parsed.data.age,
    sex: parsed.data.sex,
    isActive: true
  })

  await seedContainersForUser(user.id)

  await db.insert(authProviders).values({
    userId: user.id,
    provider: 'credentials',
    providerAccountId: parsed.data.email
  })

  await writeSession(event, toSessionUser(user), user.sessionEpoch)

  return { success: true }
})
