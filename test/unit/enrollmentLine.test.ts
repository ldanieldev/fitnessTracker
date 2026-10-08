import { describe, expect, it } from 'vitest'
import { shortDate } from '../../app/utils/enrollmentLine'

describe('shortDate', () => {
  it('formats an ISO date as weekday, month and day', () => {
    expect(shortDate('2026-10-05')).toBe('Mon, Oct 5')
  })

  it('reads the date as local midnight, so a year boundary does not slip a day', () => {
    expect(shortDate('2027-01-01')).toBe('Fri, Jan 1')
  })

  it('keeps the calendar day on both DST change dates', () => {
    expect(shortDate('2026-03-08')).toBe('Sun, Mar 8')
    expect(shortDate('2026-11-01')).toBe('Sun, Nov 1')
  })
})
