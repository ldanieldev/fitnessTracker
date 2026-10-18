import type { H3Event } from 'h3'
import { z } from 'zod'
import { logger } from '~~/server/utils/logger'
import { issuePaths } from '~~/server/utils/validation'

export function parseWith<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    logger.debug({ paths: issuePaths(parsed.error) }, 'request validation failed')
    throw createError({ statusCode: 400, statusMessage: 'Validation Error', data: z.flattenError(parsed.error) })
  }
  return parsed.data
}

export async function parseBody<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.infer<T>> {
  return parseWith(schema, await readBody(event))
}

export function parseQuery<T extends z.ZodType>(event: H3Event, schema: T): z.infer<T> {
  return parseWith(schema, getQuery(event))
}
