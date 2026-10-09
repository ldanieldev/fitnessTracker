export function goalReached(current: number | null, target: number, lowerIsBetter: boolean): boolean {
  if (current == null) return false
  return lowerIsBetter ? current <= target : current >= target
}

export function workoutGoalProgress(current: number | null, target: number, lowerIsBetter: boolean): number {
  if (current == null || target <= 0) return 0
  const ratio = lowerIsBetter ? target / Math.max(current, Number.EPSILON) : current / target
  return Math.min(Math.max(ratio, 0), 1)
}
