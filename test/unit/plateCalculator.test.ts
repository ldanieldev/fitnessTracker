import { describe, expect, it } from 'vitest'

describe('plate calculator logic', () => {
  it('should calculate total weight from plates and bar', async () => {
    const { calculateTotalWeight } = await import('../../app/utils/plateCalculator')
    const plates = [{ weight: 45, count: 1 }]
    expect(calculateTotalWeight(plates, 45)).toBe(135)
  })

  it('should handle multiple plate types', async () => {
    const { calculateTotalWeight } = await import('../../app/utils/plateCalculator')
    const plates = [
      { weight: 45, count: 1 },
      { weight: 25, count: 1 },
      { weight: 5, count: 1 }
    ]
    expect(calculateTotalWeight(plates, 45)).toBe(195)
  })

  it('should handle multiple of same plate', async () => {
    const { calculateTotalWeight } = await import('../../app/utils/plateCalculator')
    const plates = [{ weight: 45, count: 2 }]
    expect(calculateTotalWeight(plates, 45)).toBe(225)
  })

  it('should return just bar weight with no plates', async () => {
    const { calculateTotalWeight } = await import('../../app/utils/plateCalculator')
    expect(calculateTotalWeight([], 45)).toBe(45)
  })

  it('should calculate plates needed for a target weight', async () => {
    const { calculatePlatesForWeight } = await import('../../app/utils/plateCalculator')
    const plates = calculatePlatesForWeight(225, 45)
    expect(plates).toEqual([{ weight: 45, count: 2 }])
  })

  it('should calculate mixed plates for target weight', async () => {
    const { calculatePlatesForWeight } = await import('../../app/utils/plateCalculator')
    const plates = calculatePlatesForWeight(185, 45)
    expect(plates).toEqual([
      { weight: 45, count: 1 },
      { weight: 25, count: 1 }
    ])
  })
})
