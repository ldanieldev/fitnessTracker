import { describe, expect, it } from 'vitest'
import { planDaily } from '../../server/utils/googleHealth/plan'

describe('planDaily', () => {
  it('upserts fetched days with no manual row', () => {
    expect(planDaily([], [{ day: '2026-10-15', value: 60 }])).toEqual({
      upserts: [{ day: '2026-10-15', value: 60 }],
      deleteIds: []
    })
  })

  it('skips a day with a manual row and deletes the synced row there (manual wins)', () => {
    const existing = [
      { id: 1, day: '2026-10-15', source: 'manual' as const },
      { id: 2, day: '2026-10-15', source: 'google' as const }
    ]
    expect(planDaily(existing, [{ day: '2026-10-15', value: 60 }])).toEqual({ upserts: [], deleteIds: [2] })
  })

  it('mirrors the window: deletes synced rows Google no longer returns, never manual ones', () => {
    const existing = [
      { id: 3, day: '2026-10-13', source: 'google' as const },
      { id: 4, day: '2026-10-12', source: 'manual' as const }
    ]
    expect(planDaily(existing, [{ day: '2026-10-14', value: 7 }])).toEqual({
      upserts: [{ day: '2026-10-14', value: 7 }],
      deleteIds: [3]
    })
  })
})
