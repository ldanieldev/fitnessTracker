import { describe, expect, it } from 'vitest'
import { energyMismatchMessage } from '../../app/utils/nutrition/energyMismatch'

describe('energyMismatchMessage', () => {
  const mismatch = { sourceKcal: 566.7, macroKcal: 171 }

  it('names the source and the per 100 g basis', () => {
    expect(energyMismatchMessage(mismatch, 'Open Food Facts')).toBe(
      'Open Food Facts says 567 kcal per 100 g, the macros give 171. Check the macros against the label.'
    )
  })

  it('words the label scan without a source', () => {
    expect(energyMismatchMessage(mismatch, null)).toBe(
      'The label says 567 kcal, the macros give 171. Check the macros against the label.'
    )
  })
})
