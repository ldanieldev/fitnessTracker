import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/mymacros/${name}`, import.meta.url), 'utf8')

describe('normalizeMmpUnit', () => {
  it('maps every gram spelling to g', async () => {
    const { normalizeMmpUnit } = await import('../../server/utils/nutrition/mymacros/parse')
    for (const raw of ['Grams', 'Gram', 'grams', 'g', 'G', 'Grams ']) expect(normalizeMmpUnit(raw)).toEqual({ unit: 'g', basisGrams: null })
  })
  it('maps ounce spellings to oz and keeps named units trimmed', async () => {
    const { normalizeMmpUnit } = await import('../../server/utils/nutrition/mymacros/parse')
    expect(normalizeMmpUnit('Ounces')).toEqual({ unit: 'oz', basisGrams: null })
    expect(normalizeMmpUnit('Oz')).toEqual({ unit: 'oz', basisGrams: null })
    expect(normalizeMmpUnit('Cookie')).toEqual({ unit: 'Cookie', basisGrams: null })
  })
  it('maps every pound spelling to lb', async () => {
    const { normalizeMmpUnit } = await import('../../server/utils/nutrition/mymacros/parse')
    for (const raw of ['Pound', 'Pounds', 'lb', 'lbs', 'LB']) expect(normalizeMmpUnit(raw)).toEqual({ unit: 'lb', basisGrams: null })
  })
  it('parses the compound serving form', async () => {
    const { normalizeMmpUnit } = await import('../../server/utils/nutrition/mymacros/parse')
    expect(normalizeMmpUnit('Serving (113 g)')).toEqual({ unit: 'Serving', basisGrams: 113 })
  })
})

describe('parseMyMacrosExport', () => {
  it('reads the date from the header, not the file name', async () => {
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const day = parseMyMacrosExport(fixture('2026-09-05.txt'), 'My Macros+ - Daily Meals')
    expect(day.date).toBe('2026-09-05')
    expect(day.fileName).toBe('My Macros+ - Daily Meals')
  })
  it('parses every entry with trimmed names, normalised units and the four nutrients', async () => {
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const day = parseMyMacrosExport(fixture('2026-09-05.txt'), '2026-09-05.txt')
    expect(day.rows).toHaveLength(18)
    expect(day.rows[0]).toMatchObject({ container: 'Meal 1', ordinal: 0, name: 'Jerk Chicken', quantity: 1, unit: 'Serving', basisGrams: null, kcal: 239.2, protein: 52.8, carbs: 2.84, fat: 0 })
    const cottage = day.rows.find((r) => r.name === 'Small curd low fat cottage cheese')!
    expect(cottage).toMatchObject({ unit: 'Serving', basisGrams: 113, quantity: 1, kcal: 90.4 })
    const onion = day.rows.find((r) => r.name === 'Onion Seasoning Mix')!
    expect(onion).toMatchObject({ unit: 'g', quantity: 56 })
    expect(day.rows.filter((r) => r.unit === 'oz').map((r) => r.quantity)).toEqual([8.47, 11.2, 12])
  })
  it('captures container and daily totals', async () => {
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const day = parseMyMacrosExport(fixture('2026-09-04.txt'), 'x')
    expect(Object.keys(day.containerTotals)).toEqual(['Meal 1', 'Meal 2', 'Meal 3', 'Snack', 'Meal 4'])
    expect(day.containerTotals.Snack).toEqual({ protein: 3, carbs: 75, fat: 21, kcal: 480 })
    expect(day.dailyTotals).toEqual({ protein: 175.03, carbs: 234.97, fat: 47.26, kcal: 2073.12 })
  })
  it('parses all four real fixtures and every daily total matches the entry sum within 0.05', async () => {
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    for (const name of ['2026-08-27.txt', '2026-09-03.txt', '2026-09-04.txt', '2026-09-05.txt']) {
      const day = parseMyMacrosExport(fixture(name), name)
      const sum = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => day.rows.reduce((a, r) => a + r[k], 0)
      for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) expect(Math.abs(sum(k) - day.dailyTotals[k])).toBeLessThan(0.05)
    }
  })
  it('parses a CRLF export identically to its LF counterpart', async () => {
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const lf = fixture('2026-09-04.txt')
    const crlf = lf.replace(/\n/g, '\r\n')
    expect(parseMyMacrosExport(crlf, '2026-09-04.txt')).toEqual(parseMyMacrosExport(lf, '2026-09-04.txt'))
  })
  it('fails loudly on an unrecognised block with the line number', async () => {
    const { parseMyMacrosExport, MyMacrosParseError } = await import('../../server/utils/nutrition/mymacros/parse')
    expect(() => parseMyMacrosExport(fixture('unknown-block.txt'), 'unknown-block.txt')).toThrow(MyMacrosParseError)
    try {
      parseMyMacrosExport(fixture('unknown-block.txt'), 'unknown-block.txt')
    } catch (e) {
      expect(e).toMatchObject({ fileName: 'unknown-block.txt', line: 20 })
    }
  })
  it('rejects a file without the header', async () => {
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    expect(() => parseMyMacrosExport('hello\n', 'h.txt')).toThrow(/header/i)
  })
  it('rejects a header date with an out-of-range month (Date yields Invalid Date)', async () => {
    const { parseMyMacrosExport, MyMacrosParseError } = await import('../../server/utils/nutrition/mymacros/parse')
    const header = `tester's Daily Meals - 13-01-2026\n`
    expect(() => parseMyMacrosExport(header, 'h.txt')).toThrow(MyMacrosParseError)
    try {
      parseMyMacrosExport(header, 'h.txt')
    } catch (e) {
      expect(e).toMatchObject({ line: 1 })
      expect((e as Error).message).toMatch(/header/i)
    }
  })
  it('rejects a header date that rolls over to another day (Date normalises it)', async () => {
    const { parseMyMacrosExport, MyMacrosParseError } = await import('../../server/utils/nutrition/mymacros/parse')
    const header = `tester's Daily Meals - 02-30-2026\n`
    expect(() => parseMyMacrosExport(header, 'h.txt')).toThrow(MyMacrosParseError)
    try {
      parseMyMacrosExport(header, 'h.txt')
    } catch (e) {
      expect(e).toMatchObject({ line: 1 })
      expect((e as Error).message).toMatch(/header/i)
    }
  })
})

describe('isMyMacrosHeader', () => {
  it('accepts a real My Macros+ header line', async () => {
    const { isMyMacrosHeader } = await import('../../server/utils/nutrition/mymacros/parse')
    expect(isMyMacrosHeader(`tester's Daily Meals - 09-04-2026`)).toBe(true)
  })
  it('rejects a non-header line', async () => {
    const { isMyMacrosHeader } = await import('../../server/utils/nutrition/mymacros/parse')
    expect(isMyMacrosHeader('hello')).toBe(false)
  })
})
