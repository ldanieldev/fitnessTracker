import { describe, expect, it } from 'vitest'
import { isTimeZone, localNoon } from '../../server/utils/nutrition/mymacros/localNoon'

describe('localNoon', () => {
  it('is 12:00 local in daylight and standard time', () => {
    expect(localNoon('2026-09-05', 'America/Chicago').toISOString()).toBe('2026-09-05T17:00:00.000Z')
    expect(localNoon('2026-12-05', 'America/Chicago').toISOString()).toBe('2026-12-05T18:00:00.000Z')
    expect(localNoon('2026-09-05', 'UTC').toISOString()).toBe('2026-09-05T12:00:00.000Z')
  })

  it('is 12:00 local on the days the clocks change', () => {
    expect(localNoon('2026-03-08', 'America/Chicago').toISOString()).toBe('2026-03-08T17:00:00.000Z')
    expect(localNoon('2026-11-01', 'America/Chicago').toISOString()).toBe('2026-11-01T18:00:00.000Z')
    expect(localNoon('2026-04-05', 'Australia/Lord_Howe').toISOString()).toBe('2026-04-05T01:30:00.000Z')
  })

  it('stays on the same calendar day at the far ends of the offsets', () => {
    expect(localNoon('2026-09-05', 'Pacific/Kiritimati').toISOString()).toBe('2026-09-04T22:00:00.000Z')
    expect(localNoon('2026-09-05', 'Pacific/Pago_Pago').toISOString()).toBe('2026-09-05T23:00:00.000Z')
  })
})

describe('isTimeZone', () => {
  it('accepts IANA names and rejects anything else', () => {
    expect(isTimeZone('America/Chicago')).toBe(true)
    expect(isTimeZone('UTC')).toBe(true)
    expect(isTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(isTimeZone('')).toBe(false)
  })
})
