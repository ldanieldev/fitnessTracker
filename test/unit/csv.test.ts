import { describe, expect, it } from 'vitest'
import { csvCell } from '../../shared/utils/csv'

describe('csvCell', () => {
  it('leaves plain values bare and blanks nullish', () => {
    expect(csvCell('Bench')).toBe('Bench')
    expect(csvCell(185.5)).toBe('185.5')
    expect(csvCell(0)).toBe('0')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('quotes values with commas, quotes, or newlines and doubles inner quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(csvCell('cr\rlf')).toBe('"cr\rlf"')
  })
})

describe('csvCell formula injection', () => {
  it('prefixes a quote to text a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`)
    expect(csvCell('+1+cmd')).toBe(`'+1+cmd`)
    expect(csvCell('-2+3')).toBe(`'-2+3`)
    expect(csvCell('@SUM(A1)')).toBe(`'@SUM(A1)`)
    expect(csvCell('\tcmd')).toBe(`'\tcmd`)
    expect(csvCell('\rcmd')).toBe(`"'\rcmd"`)
  })

  it('leaves numbers, numeric text and safe text alone', () => {
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell(-0.5)).toBe('-0.5')
    expect(csvCell('-12.5')).toBe('-12.5')
    expect(csvCell('+3')).toBe('+3')
    expect(csvCell('1e-3')).toBe('1e-3')
    expect(csvCell('Bench - heavy')).toBe('Bench - heavy')
    expect(csvCell('2026-10-16')).toBe('2026-10-16')
  })
})
