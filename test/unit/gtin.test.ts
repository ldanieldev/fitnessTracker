import { describe, expect, it } from 'vitest'
import { toGtin13 } from '../../shared/utils/gtin'

describe('toGtin13', () => {
  it('prefixes a 12-digit UPC-A with a zero', () => {
    expect(toGtin13('094395000172')).toBe('0094395000172')
  })

  it('leaves a 13-digit GTIN unchanged', () => {
    expect(toGtin13('0009800800049')).toBe('0009800800049')
  })

  it('leaves an 8-digit EAN unchanged', () => {
    expect(toGtin13('40123455')).toBe('40123455')
  })

  it('strips whitespace before checking length', () => {
    expect(toGtin13(' 094395000172 ')).toBe('0094395000172')
  })

  it('passes non-standard lengths through as stripped digits', () => {
    expect(toGtin13('abc-123')).toBe('123')
  })
})
