import { describe, expect, it } from 'vitest'
import { sessionFilterQuerySchema, sessionListQuerySchema } from '../../server/utils/workouts/input'

describe('sessionFilterQuerySchema', () => {
  it('parses a full query string', () => {
    expect(
      sessionFilterQuerySchema.parse({
        from: '2026-01-01',
        to: '2026-01-31',
        categories: '3,5',
        match: 'all',
        exerciseId: '12',
        minWeight: '225',
        minReps: '5'
      })
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      categories: [3, 5],
      match: 'all',
      exerciseId: 12,
      minWeight: 225,
      minReps: 5
    })
  })

  it('defaults match to any', () => {
    expect(sessionFilterQuerySchema.parse({}).match).toBe('any')
  })

  it.each([
    [{ from: '2026-02-01', to: '2026-01-01' }],
    [{ minWeight: '100' }],
    [{ minReps: '5' }],
    [{ categories: '3,x' }],
    [{ from: '2026-02-30' }],
    [{ match: 'some' }],
    [{ exerciseId: '12', minReps: '0' }]
  ])('rejects %j', (query) => {
    expect(sessionFilterQuerySchema.safeParse(query).success).toBe(false)
  })

  it('names a bad category id in the error', () => {
    for (const categories of ['3,x', '0', '3.5', '-1']) {
      const issues = sessionFilterQuerySchema.safeParse({ categories }).error?.issues ?? []
      expect(
        issues.map((issue) => issue.message),
        categories
      ).toEqual(['Invalid category id'])
    }
  })

  it('parses categories as positive integers, trimming blanks, up to fifty', () => {
    expect(sessionFilterQuerySchema.parse({ categories: ' 4 , 2,,' }).categories).toEqual([4, 2])
    expect(
      sessionFilterQuerySchema.parse({ categories: Array.from({ length: 50 }, (_, i) => i + 1).join(',') }).categories
    ).toHaveLength(50)
    for (const categories of ['0', '3.5', '-1', Array.from({ length: 51 }, (_, i) => i + 1).join(',')]) {
      expect(sessionFilterQuerySchema.safeParse({ categories }).success).toBe(false)
    }
  })

  it('list schema keeps the limit and the same rules', () => {
    expect(sessionListQuerySchema.parse({ limit: '40', categories: '1' })).toMatchObject({ limit: 40, categories: [1] })
    expect(sessionListQuerySchema.safeParse({ minReps: '5' }).success).toBe(false)
  })
})
