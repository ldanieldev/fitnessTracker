import { describe, expect, it } from 'vitest'

describe('parseAmount', () => {
  it('parses decimals with . or , and rejects blanks', async () => {
    const { parseAmount } = await import('../../app/utils/nutrition/numberInput')
    expect(parseAmount('100')).toBe(100)
    expect(parseAmount('1.5')).toBe(1.5)
    expect(parseAmount('1,5')).toBe(1.5)
    expect(parseAmount('1.')).toBe(1)
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('-')).toBeNull()
  })
})
