import { z } from 'zod'
import { db } from '~~/server/utils/db'
import { getExternalSources } from '~~/server/utils/nutrition/external/registry'
import { ExternalSourceError } from '~~/server/utils/nutrition/external/types'
import { importExternalFood } from '~~/server/utils/nutrition/importFood'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/nutrition/session'

const importSchema = z.object({
  source: z.enum(['off', 'usda', 'fatsecret']),
  externalId: z.string().min(1)
})

const ERROR_STATUS: Record<Exclude<ExternalSourceError['kind'], 'not_found'>, number> = {
  unconfigured: 503,
  rate_limited: 429,
  unavailable: 502
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, importSchema)

  const source = getExternalSources().find((s) => s.key === body.source)
  if (!source) throw createError({ statusCode: 400, statusMessage: `${body.source} is not configured` })

  let external
  try {
    external = await source.byId(body.externalId)
  } catch (err) {
    if (err instanceof ExternalSourceError) {
      // Client contracts guarantee byId returns null rather than throwing 'not_found'; 404 here is defensive only.
      const status = err.kind === 'not_found' ? 404 : ERROR_STATUS[err.kind]
      throw createError({ statusCode: status, statusMessage: err.message })
    }
    throw err
  }
  if (!external) throw createError({ statusCode: 404, statusMessage: 'External food not found' })

  return importExternalFood(db, userId, external)
})
