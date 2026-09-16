import { describe, expect, it } from 'vitest'
import { useBodyRange } from '../../app/composables/useBodyRange'

describe('useBodyRange', () => {
  it('shares one selection between callers and defaults to month-to-date', () => {
    const a = useBodyRange()
    expect(a.value).toBe('mtd')
    a.value = '1y'
    expect(useBodyRange().value).toBe('1y')
  })
})
