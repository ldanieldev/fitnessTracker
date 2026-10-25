import { z } from 'zod'
import { db } from '~~/server/utils/db'
import { getExternalSources } from '~~/server/utils/nutrition/external/registry'
import { expectedFailure } from '~~/server/utils/expectedFailure'
import { ExternalSourceError } from '~~/server/utils/nutrition/external/types'
import { importExternalFood } from '~~/server/utils/nutrition/importFood'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import type { ImportedFoodResponse } from '~~/shared/types/nutrition'
import { sourceEnergyMismatch } from '~~/shared/utils/nutritionDerive'

const importSchema = z.object({
  source: z.enum(['off', 'usda', 'fatsecret']),
  externalId: z.string().min(1).max(64)
})

const ERROR_STATUS: Record<Exclude<ExternalSourceError['kind'], 'not_found'>, number> = {
  unconfigured: 503,
  rate_limited: 429,
  unavailable: 502
}

export default defineEventHandler(async (event): Promise<ImportedFoodResponse> => {
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
      // The source registry already logged this outage, so it must not also become a Sentry issue.
      throw expectedFailure({ statusCode: status, statusMessage: err.message })
    }
    throw err
  }
  if (!external) throw createError({ statusCode: 404, statusMessage: 'External food not found' })

  const imported = await importExternalFood(db, userId, external)
  return { ...imported, energyMismatch: external.per100g ? sourceEnergyMismatch(external.per100g) : null }
})
