import { describe, expect, it } from 'vitest'
import { durationLabel, fromLocalInput, toLocalInput } from '../../shared/utils/workoutTime'

const start = '2026-09-18T10:00:00.000Z'
const at = (iso: string) => new Date(iso).getTime()

describe('durationLabel', () => {
  it('formats under an hour as m:ss', () => {
    expect(durationLabel(start, at('2026-09-18T10:01:05.000Z'))).toBe('1:05')
    expect(durationLabel(start, at('2026-09-18T10:00:09.000Z'))).toBe('0:09')
  })

  it('formats an hour and over as h:mm:ss', () => {
    expect(durationLabel(start, at('2026-09-18T11:01:40.000Z'))).toBe('1:01:40')
    expect(durationLabel(start, at('2026-09-18T12:00:00.000Z'))).toBe('2:00:00')
  })

  it('clamps an end before the start to zero', () => {
    expect(durationLabel(start, at('2026-09-18T09:30:00.000Z'))).toBe('0:00')
  })
})

describe('datetime-local conversion', () => {
  it('round-trips a local wall time through ISO', () => {
    const iso = fromLocalInput('2026-09-18T18:45')
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/)
    expect(toLocalInput(iso!)).toBe('2026-09-18T18:45')
  })

  it('pads single-digit parts', () => {
    expect(toLocalInput(fromLocalInput('2026-01-02T03:04')!)).toBe('2026-01-02T03:04')
  })

  it('is null for an empty or unparseable value', () => {
    expect(fromLocalInput('')).toBe(null)
    expect(fromLocalInput('not a time')).toBe(null)
  })
})
