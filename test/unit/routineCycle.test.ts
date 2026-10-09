import { describe, expect, it } from 'vitest'
import { advancePointer, dueDayId, needsPointerChoice, skipPointer } from '../../shared/utils/routineCycle'

const days = [
  { id: 1, floating: false },
  { id: 2, floating: false },
  { id: 9, floating: true },
  { id: 3, floating: false }
]

describe('dueDayId', () => {
  it('uses the stored pointer', () => {
    expect(dueDayId(days, 2)).toBe(2)
  })

  it('falls back to the first rotation day when the pointer is null or unknown', () => {
    expect(dueDayId(days, null)).toBe(1)
    expect(dueDayId(days, 77)).toBe(1)
  })

  it('ignores a floating pointer', () => {
    expect(dueDayId(days, 9)).toBe(1)
  })

  it('has nothing due when every day floats', () => {
    expect(dueDayId([{ id: 4, floating: true }], null)).toBeNull()
  })
})

describe('advancePointer', () => {
  it('moves past the due day, skipping floating days and wrapping', () => {
    expect(advancePointer(days, 1, 1)).toBe(2)
    expect(advancePointer(days, 2, 2)).toBe(3)
    expect(advancePointer(days, 3, 3)).toBe(1)
  })

  it('leaves the pointer alone for a floating day', () => {
    expect(advancePointer(days, 2, 9)).toBe(2)
  })

  it('skip moves to the day after the one started; keep holds', () => {
    expect(advancePointer(days, 2, 3, 'skip')).toBe(1)
    expect(advancePointer(days, 2, 3, 'keep')).toBe(2)
  })

  it('treats a null pointer as the first day being due', () => {
    expect(advancePointer(days, null, 1)).toBe(2)
  })
})

describe('needsPointerChoice', () => {
  it('asks only for an off-order rotation day', () => {
    expect(needsPointerChoice(days, 2, 2)).toBe(false)
    expect(needsPointerChoice(days, 2, 9)).toBe(false)
    expect(needsPointerChoice(days, 2, 3)).toBe(true)
    expect(needsPointerChoice(days, null, 1)).toBe(false)
  })
})

describe('skipPointer', () => {
  it('moves one rotation day forward', () => {
    expect(skipPointer(days, 2)).toBe(3)
    expect(skipPointer(days, 3)).toBe(1)
    expect(skipPointer(days, null)).toBe(2)
    expect(skipPointer([], null)).toBeNull()
  })
})
