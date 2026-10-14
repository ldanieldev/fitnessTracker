import { describe, expect, it } from 'vitest'

const rows = [
  {
    date: '2026-09-01',
    logged: true,
    incomplete: false,
    profileName: 'Cut',
    totals: { energy: 1565.04, protein: 122.52 },
    targets: { energy: { amount: 2000 } }
  },
  { date: '2026-09-02', logged: false, incomplete: false, profileName: null, totals: {}, targets: null },
  { date: '2026-09-03', logged: true, incomplete: true, profileName: 'Cut', totals: { energy: 474 }, targets: null }
]

describe('toCsv', () => {
  it('emits a header of date, profile, incomplete and each nutrient key with its target', async () => {
    const { toCsv } = await import('../../shared/utils/nutritionExport')
    expect(toCsv(rows, ['energy', 'protein']).split('\n')[0]).toBe(
      'date,profile,incomplete,energy,energy_target,protein,protein_target'
    )
  })

  it('leaves unlogged days blank rather than writing zero', async () => {
    const { toCsv } = await import('../../shared/utils/nutritionExport')
    expect(toCsv(rows, ['energy', 'protein']).split('\n')[2]).toBe('2026-09-02,,false,,,,')
  })

  it('preserves full precision', async () => {
    const { toCsv } = await import('../../shared/utils/nutritionExport')
    expect(toCsv(rows, ['energy']).split('\n')[1]).toBe('2026-09-01,Cut,false,1565.04,2000')
  })

  it('leaves the target cell blank for a nutrient the day has no target for', async () => {
    const { toCsv } = await import('../../shared/utils/nutritionExport')
    expect(toCsv(rows, ['protein']).split('\n')[1]).toBe('2026-09-01,Cut,false,122.52,')
  })

  it('quotes a profile name containing a comma', async () => {
    const { toCsv } = await import('../../shared/utils/nutritionExport')
    const withComma = [{ date: '2026-09-01', logged: true, incomplete: false, profileName: '230 lb, cut', totals: {} }]
    expect(toCsv(withComma, [])).toContain('"230 lb, cut"')
  })

  it('flags an incomplete day so a reader can leave it out of averages', async () => {
    const { toCsv } = await import('../../shared/utils/nutritionExport')
    expect(toCsv(rows, ['energy']).split('\n')[3]).toBe('2026-09-03,Cut,true,474,')
  })
})
