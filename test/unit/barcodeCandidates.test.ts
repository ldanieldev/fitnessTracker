import { describe, expect, it } from 'vitest'
import { barcodeCandidates } from '../../server/utils/nutrition/barcodeCandidates'

describe('barcodeCandidates', () => {
  it('includes the zero-padded GTIN-13 for a 12-digit UPC-A', () => {
    expect(barcodeCandidates('094395000172')).toEqual(['094395000172', '0094395000172'])
  })

  it('includes the un-padded UPC-A for a zero-padded GTIN-13', () => {
    expect(barcodeCandidates('0094395000172')).toEqual(['0094395000172', '094395000172'])
  })

  it('returns just itself for a GTIN-13 that does not start with zero', () => {
    expect(barcodeCandidates('3017624010701')).toEqual(['3017624010701'])
  })
})
