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
