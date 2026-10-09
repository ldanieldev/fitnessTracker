import type { SetMeasures } from '../types/workout'

export function prefillFor(currentSets: SetMeasures[], lastSets: SetMeasures[]): SetMeasures {
  const source = currentSets.at(-1) ?? lastSets.at(-1)
  if (!source) return {}
  return { ...source }
}
