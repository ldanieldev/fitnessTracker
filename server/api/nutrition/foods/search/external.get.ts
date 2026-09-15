import { z } from 'zod'
import { aggregateExternalResults, getExternalSources } from '~~/server/utils/nutrition/external/registry'
import type { ExternalSourceKey } from '~~/server/utils/nutrition/external/types'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

const ALL_SOURCE_KEYS: ExternalSourceKey[] = ['off', 'usda', 'fatsecret']

const querySchema = z.object({
  q: z.string().trim().min(1).max(100),
  source: z.enum(['off', 'usda', 'fatsecret', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(25).default(10)
})

export default defineEventHandler(async (event) => {
  await requireUserId(event)
  const query = parseQuery(event, querySchema)
  const requestedKeys = query.source === 'all' ? ALL_SOURCE_KEYS : [query.source]

  const available = getExternalSources()
  const availableByKey = new Map(available.map((source) => [source.key, source]))
  const selected = requestedKeys.flatMap((key) => availableByKey.get(key) ?? [])

  const settled = await Promise.allSettled(selected.map((source) => source.search(query.q, query.limit)))
  const { results, errors } = aggregateExternalResults(
    selected.map((source, i) => ({ source: source.key, result: settled[i]! }))
  )

  for (const key of requestedKeys) {
    if (!availableByKey.has(key)) errors.push({ source: key, kind: 'unconfigured', message: `${key} is not configured` })
  }

  return { results, errors }
})
