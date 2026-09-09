import { describe, expect, it } from 'vitest'

const candidates = [
  { id: 1, name: 'Chicken breast', relevance: 0.9 },
  { id: 2, name: 'Chicken thigh', relevance: 0.8 },
  { id: 3, name: 'Chicken wing', relevance: 0.7 }
]

describe('rerank', () => {
  it('lifts favourites above higher-relevance non-favourites', async () => {
    const { rerank } = await import('../../server/utils/nutrition/searchRank')
    const out = rerank(candidates, { favorites: new Set([3]), usage: new Map() })
    expect(out[0]!.id).toBe(3)
  })

  it('orders non-favourites by log count before relevance', async () => {
    const { rerank } = await import('../../server/utils/nutrition/searchRank')
    const out = rerank(candidates, { favorites: new Set(), usage: new Map([[2, 40]]) })
    expect(out[0]!.id).toBe(2)
  })

  it('falls back to relevance when no personal signal exists', async () => {
    const { rerank } = await import('../../server/utils/nutrition/searchRank')
    const out = rerank(candidates, { favorites: new Set(), usage: new Map() })
    expect(out.map((h) => h.id)).toEqual([1, 2, 3])
  })

  it('is stable for equal scores', async () => {
    const { rerank } = await import('../../server/utils/nutrition/searchRank')
    const tied = candidates.map((c) => ({ ...c, relevance: 0.5 }))
    const out = rerank(tied, { favorites: new Set(), usage: new Map() })
    expect(out.map((h) => h.id)).toEqual([1, 2, 3])
  })
})
