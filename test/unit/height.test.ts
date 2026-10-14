import { describe, expect, it } from 'vitest'
import { joinHeight, splitHeight } from '../../shared/utils/height'

describe('height', () => {
  it('splits total inches into feet and inches', () => {
    expect(splitHeight(65.5)).toEqual({ feet: 5, inches: 5.5 })
    expect(splitHeight(72)).toEqual({ feet: 6, inches: 0 })
    expect(splitHeight(null)).toEqual({ feet: null, inches: null })
  })

  it('joins feet and inches, treating a blank part as zero and both blank as no height', () => {
    expect(joinHeight(5, 5.5)).toBe(65.5)
    expect(joinHeight(6, null)).toBe(72)
    expect(joinHeight(null, 70)).toBe(70)
    expect(joinHeight(null, null)).toBeNull()
    expect(joinHeight(undefined, undefined)).toBeNull()
  })

  it('round-trips through split and join', () => {
    for (const total of [36, 59.9, 65.5, 71, 96]) {
      const parts = splitHeight(total)
      expect(joinHeight(parts.feet, parts.inches)).toBe(total)
    }
  })
})
