import { describe, expect, it } from 'vitest'
import { assetPlan, EXERCISE_ASSET_BASE } from '../../shared/utils/exerciseAssets'

describe('assetPlan', () => {
  it('builds a pinned URL and a local path for each image', () => {
    const [first] = assetPlan(['Air_Bike/0.jpg'], new Set())
    expect(first).toEqual({ path: 'Air_Bike/0.jpg', url: `${EXERCISE_ASSET_BASE}/Air_Bike/0.jpg` })
  })

  it('skips images already on disk', () => {
    expect(assetPlan(['A/0.jpg', 'B/0.jpg'], new Set(['A/0.jpg']))).toHaveLength(1)
  })

  it('pins the commit rather than tracking a branch', () => {
    expect(EXERCISE_ASSET_BASE).toContain('a859101d633a01c4a1a920d6a8ce41dabba0705f')
    expect(EXERCISE_ASSET_BASE).not.toContain('/main/')
  })

  it('drops duplicates so a shared image is fetched once', () => {
    expect(assetPlan(['A/0.jpg', 'A/0.jpg'], new Set())).toHaveLength(1)
  })
})
