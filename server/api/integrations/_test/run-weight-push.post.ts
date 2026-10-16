import { z } from 'zod'
import { pushWeight } from '~~/server/utils/googleHealth/weightPush'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

const bodySchema = z.object({
  measurementId: z.number().int(),
  utcOffsetMinutes: z.number().int().nullable().default(null),
  previousExternalId: z.string().nullable().default(null),
  deleted: z.boolean().default(false)
})

export default defineEventHandler(async (event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const userId = await requireUserId(event)
  const body = await parseBody(event, bodySchema)
  return { result: await pushWeight({ userId, ...body }) }
})
