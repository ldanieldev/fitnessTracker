import { describe, expect, it } from 'vitest'
import { CATEGORY_DOT_CLASS } from '../../shared/utils/categoryColors'
import { anchorFor, PHASE_COLORS, phaseColorClass, programPosition, weekStartOf } from '../../shared/utils/programs'

const phases = [
  { id: 10, weeks: 2 },
  { id: 20, weeks: 1 },
  { id: 30, weeks: 3 }
]

describe('weekStartOf', () => {
  it('returns the Monday on or before the date for Monday-start users', () => {
    expect(weekStartOf('2026-10-01', 1)).toBe('2026-09-28')
    expect(weekStartOf('2026-09-28', 1)).toBe('2026-09-28')
    expect(weekStartOf('2026-10-04', 1)).toBe('2026-09-28')
  })

  it('returns the Sunday on or before the date for Sunday-start users', () => {
    expect(weekStartOf('2026-10-01', 0)).toBe('2026-09-27')
    expect(weekStartOf('2026-10-04', 0)).toBe('2026-10-04')
  })

  it('crosses a month and year boundary', () => {
    expect(weekStartOf('2027-01-01', 1)).toBe('2026-12-28')
  })
})

describe('anchorFor', () => {
  it('anchors now at this week start and next at the following one', () => {
    expect(anchorFor('now', '2026-10-01', 1)).toBe('2026-09-28')
    expect(anchorFor('next', '2026-10-01', 1)).toBe('2026-10-05')
  })

  it('anchors next a week out even on the week start itself', () => {
    expect(anchorFor('next', '2026-09-28', 1)).toBe('2026-10-05')
  })
})

describe('programPosition', () => {
  const base = { anchorDate: '2026-09-28', anchorWeek: 1, weekStart: 1 as const, phases }

  it('is between weeks before the anchor date', () => {
    expect(programPosition({ ...base, today: '2026-09-27' })).toMatchObject({
      state: 'between',
      week: 1,
      phase: phases[0],
      phaseIndex: 0,
      weekInPhase: 1,
      totalWeeks: 6
    })
  })

  it('counts the anchor week from its first to its last day', () => {
    expect(programPosition({ ...base, today: '2026-09-28' })).toMatchObject({ state: 'current', week: 1 })
    expect(programPosition({ ...base, today: '2026-10-04' })).toMatchObject({ state: 'current', week: 1 })
    expect(programPosition({ ...base, today: '2026-10-05' })).toMatchObject({ state: 'current', week: 2 })
  })

  it('maps weeks onto phases at the boundary', () => {
    expect(programPosition({ ...base, today: '2026-10-11' })).toMatchObject({
      week: 2,
      phase: phases[0],
      weekInPhase: 2
    })
    expect(programPosition({ ...base, today: '2026-10-12' })).toMatchObject({
      week: 3,
      phase: phases[1],
      phaseIndex: 1,
      weekInPhase: 1
    })
    expect(programPosition({ ...base, today: '2026-10-19' })).toMatchObject({
      week: 4,
      phase: phases[2],
      phaseIndex: 2,
      weekInPhase: 1
    })
  })

  it('finishes after the last week', () => {
    expect(programPosition({ ...base, today: '2026-11-08' })).toMatchObject({ state: 'current', week: 6 })
    expect(programPosition({ ...base, today: '2026-11-09' })).toMatchObject({
      state: 'finished',
      week: 7,
      phase: null,
      phaseIndex: -1
    })
  })

  it('resumes mid-program from a later anchor week', () => {
    expect(programPosition({ ...base, anchorDate: '2027-01-04', anchorWeek: 4, today: '2027-01-06' })).toMatchObject({
      state: 'current',
      week: 4,
      phase: phases[2]
    })
  })

  it('sunday-start week boundary', () => {
    const sunday = { ...base, anchorDate: '2026-09-27', weekStart: 0 as const }
    expect(programPosition({ ...sunday, today: '2026-10-03' })).toMatchObject({ week: 1 })
    expect(programPosition({ ...sunday, today: '2026-10-04' })).toMatchObject({ week: 2 })
  })

  it('is finished with no phases', () => {
    expect(programPosition({ ...base, phases: [], today: '2026-09-28' })).toMatchObject({
      state: 'finished',
      totalWeeks: 0
    })
  })

  it('survives a DST change inside the span', () => {
    expect(programPosition({ ...base, anchorDate: '2026-10-26', today: '2026-11-02' })).toMatchObject({ week: 2 })
  })
})

describe('phaseColorClass', () => {
  it('maps a phase index to its category dot class and wraps past the palette', () => {
    expect(phaseColorClass(0)).toBe(CATEGORY_DOT_CLASS[PHASE_COLORS[0]!])
    expect(phaseColorClass(PHASE_COLORS.length + 2)).toBe(phaseColorClass(2))
  })
})
