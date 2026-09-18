import { coalesceOutboxRows, drainOutbox, type OutboxDrainResult } from '../search/outboxDrain'
import { MeiliSearchProvider } from './meiliSearch'
import { getSearchProvider, isDegradedProvider } from './searchProvider'

// Aliased, not re-exported: server/utils is auto-imported, so a second export of the same name warns on every build.
export const coalesceOutbox = coalesceOutboxRows
export type DrainResult = OutboxDrainResult

export async function drainSearchOutbox(limit = 500): Promise<DrainResult> {
  const provider = await getSearchProvider()
  if (isDegradedProvider(provider)) return { processed: 0, failed: 0, skipped: true, rebuilt: false }
  const isEmpty = provider instanceof MeiliSearchProvider ? () => provider.isEmpty() : undefined
  return drainOutbox('food', provider, { isEmpty }, limit)
}
