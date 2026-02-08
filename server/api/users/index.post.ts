import bcrypt from 'bcrypt'
import { getTableColumns } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '~~/server/db/schema'

const userSchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
  sex: z.union([z.literal('m'), z.literal('f')]).optional(),
  age: z.number()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const schemaValidation = userSchema.safeParse(body)

  if (!schemaValidation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: z.flattenError(schemaValidation.error)
    })
  }

  const passwordHash = await bcrypt.hash(body.password, 12)

  try {
    const { password, ...userColumns } = getTableColumns(users)
    const result = await db
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        sex: body.sex,
        password: passwordHash,
        isActive: true,
        age: body.age
      })
      .returning(userColumns)
    return result[0]
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Email already exists' })
    }
    throw error
  }
})
