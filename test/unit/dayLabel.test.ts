import { describe, expect, it } from 'vitest'
import { formatDayLabel } from '../../shared/utils/dayLabel'

describe('formatDayLabel', () => {
  it('formats a calendar date without shifting it by the local zone', () => {
    expect(formatDayLabel('2026-10-11')).toBe('Sun, Oct 11, 2026')
    expect(formatDayLabel('2026-01-01')).toBe('Thu, Jan 1, 2026')
  })
})
