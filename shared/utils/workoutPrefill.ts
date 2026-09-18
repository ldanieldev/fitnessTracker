import type { SetMeasures } from '../types/workout'

export function prefillFor(currentSets: SetMeasures[], lastSets: SetMeasures[]): SetMeasures {
  const source = currentSets.at(-1) ?? lastSets.at(-1)
  if (!source) return {}
  return { ...source }
}

export function lastTimeFor(index: number, lastSets: SetMeasures[]): SetMeasures | null {
  if (lastSets.length === 0) return null
  return lastSets[Math.min(index, lastSets.length - 1)] ?? null
}
