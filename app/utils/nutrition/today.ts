export function msUntilNextMidnight(now: Date): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  return nextMidnight.getTime() - now.getTime()
}
