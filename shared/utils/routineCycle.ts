import type { PointerChoice } from '../types/workout'

export interface CycleDay {
  id: number
  floating: boolean
}

export function dueDayId(days: CycleDay[], nextDayId: number | null): number | null {
  if (nextDayId !== null && days.some((day) => day.id === nextDayId && !day.floating)) return nextDayId
  return days.find((day) => !day.floating)?.id ?? null
}

function followingDayId(days: CycleDay[], dayId: number | null): number | null {
  const rotation = days.filter((day) => !day.floating)
  if (!rotation.length) return null
  const index = rotation.findIndex((day) => day.id === dayId)
  if (index === -1) return rotation[0]!.id
  return rotation[(index + 1) % rotation.length]!.id
}

export function needsPointerChoice(days: CycleDay[], nextDayId: number | null, startedDayId: number): boolean {
  const day = days.find((candidate) => candidate.id === startedDayId)
  if (!day || day.floating) return false
  return dueDayId(days, nextDayId) !== startedDayId
}

export function advancePointer(
  days: CycleDay[],
  nextDayId: number | null,
  startedDayId: number,
  choice?: PointerChoice
): number | null {
  const day = days.find((candidate) => candidate.id === startedDayId)
  if (!day || day.floating) return nextDayId
  if (dueDayId(days, nextDayId) === startedDayId || choice === 'skip') return followingDayId(days, startedDayId)
  return nextDayId
}

export function skipPointer(days: CycleDay[], nextDayId: number | null): number | null {
  return followingDayId(days, dueDayId(days, nextDayId))
}
