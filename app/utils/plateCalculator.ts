import type { PlateCount } from '../types/workout'
import { STANDARD_PLATES } from '../constants/workout'

export function calculateTotalWeight(plates: PlateCount[], barWeight: number): number {
  const plateWeight = plates.reduce((sum, p) => sum + p.weight * p.count * 2, 0)
  return barWeight + plateWeight
}

export function calculatePlatesForWeight(targetWeight: number, barWeight: number): PlateCount[] {
  let remaining = (targetWeight - barWeight) / 2
  const result: PlateCount[] = []

  for (const plate of STANDARD_PLATES) {
    if (remaining >= plate) {
      const count = Math.floor(remaining / plate)
      result.push({ weight: plate, count })
      remaining -= plate * count
    }
  }

  return result
}
