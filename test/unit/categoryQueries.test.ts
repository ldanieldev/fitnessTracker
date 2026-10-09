import { describe, expect, it, vi } from 'vitest'
import type { DbClient } from '../../server/utils/db'

vi.mock('../../server/utils/db', () => ({ db: {} }))

// A transaction client must never have two queries in flight: pg deprecates it and the second query queues anyway.
function trackingClient() {
  const state = { inFlight: 0, maxInFlight: 0, queries: 0 }
  const chain = {
    from: () => chain,
    where: () => chain,
    then<A = unknown[], B = never>(
      onfulfilled?: ((value: unknown[]) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
    ): PromiseLike<A | B> {
      state.queries++
      state.inFlight++
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight)
      return new Promise<unknown[]>((resolve) => setTimeout(() => {
        state.inFlight--
        resolve([])
      }, 5)).then(onfulfilled, onrejected)
    }
  }
  const client = { select: () => chain } as unknown as DbClient
  return { client, state }
}

const emptyCatalogue = { exercises: [], categories: [], muscles: [], equipment: [] }

describe('category reads on a passed client', () => {
  it('loadCategoriesByIds runs its queries one at a time', async () => {
    const { loadCategoriesByIds } = await import('../../server/utils/workouts/categories')
    const { client, state } = trackingClient()
    await loadCategoriesByIds(1, [2, 3], client)
    expect(state.queries).toBe(2)
    expect(state.maxInFlight).toBe(1)
  })

  it('listCategoriesForUser runs its queries one at a time', async () => {
    const { listCategoriesForUser } = await import('../../server/utils/workouts/categories')
    const { client, state } = trackingClient()
    await listCategoriesForUser(1, { client, catalogue: emptyCatalogue })
    expect(state.queries).toBe(2)
    expect(state.maxInFlight).toBe(1)
  })
})
