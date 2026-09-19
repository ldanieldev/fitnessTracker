import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLATE_SIZES,
  effectivePlateSizes,
  normalizePlateSizes,
  plateSizesSchema
} from '../../shared/utils/plates'

describe('plateSizesSchema', () => {
  it('accepts the default set and odd sizes', () => {
    expect(plateSizesSchema.safeParse(DEFAULT_PLATE_SIZES).success).toBe(true)
    expect(plateSizesSchema.safeParse([55, 1.25, 0.5]).success).toBe(true)
  })

  it('rejects empty, oversized, duplicate, non-positive and over-precise sizes', () => {
    expect(plateSizesSchema.safeParse([]).success).toBe(false)
    expect(plateSizesSchema.safeParse(Array.from({ length: 13 }, (_, i) => i + 1)).success).toBe(false)
    expect(plateSizesSchema.safeParse([45, 45]).success).toBe(false)
    expect(plateSizesSchema.safeParse([0]).success).toBe(false)
    expect(plateSizesSchema.safeParse([101]).success).toBe(false)
    expect(plateSizesSchema.safeParse([1.125]).success).toBe(false)
  })
})

describe('normalizePlateSizes', () => {
  it('dedupes and sorts heaviest first', () => {
    expect(normalizePlateSizes([2.5, 45, 10, 45, 55])).toEqual([55, 45, 10, 2.5])
  })
})

describe('effectivePlateSizes', () => {
  it('uses the override for a barbell exercise, else the fallback', () => {
    expect(effectivePlateSizes('barbell', ['55', '45'], ['45', '25'])).toEqual([55, 45])
    expect(effectivePlateSizes('barbell', null, ['45', '25'])).toEqual([45, 25])
  })

  it('is null for anything but a barbell exercise', () => {
    expect(effectivePlateSizes('plain', ['55'], ['45'])).toBeNull()
    expect(effectivePlateSizes(null, null, ['45'])).toBeNull()
  })
})
