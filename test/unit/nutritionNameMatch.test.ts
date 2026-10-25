import { describe, expect, it } from 'vitest'
import { barcodeHint, namesDiffer } from '../../app/utils/nutrition/nameMatch'

describe('namesDiffer', () => {
  it('flags a different product name', () => {
    expect(namesDiffer('Dry roasted unsalted peanuts', 'Dry Roasted Peanuts Seasoned with Sea Salt')).toBe(true)
  })

  it('ignores case, punctuation and extra spaces', () => {
    expect(namesDiffer('Biscoff Cookie Butter', 'biscoff  cookie-butter')).toBe(false)
  })

  it('is false when either side is blank', () => {
    expect(namesDiffer('', 'X')).toBe(false)
    expect(namesDiffer('X', '  ')).toBe(false)
  })
})

describe('barcodeHint', () => {
  it('offers the barcode value only while it differs from the field', () => {
    expect(barcodeHint('Kirkland', 'Great Value')).toBe('Great Value')
    expect(barcodeHint('great value', 'Great Value')).toBeNull()
    expect(barcodeHint('Kirkland', null)).toBeNull()
  })
})
