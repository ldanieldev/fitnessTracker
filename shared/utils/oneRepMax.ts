import type { HistoryStamp, OneRepMaxResult, OneRepMaxSource } from '../types/workout'

export const MAX_ESTIMATE_REPS = 10
export const ESTIMATE_WINDOW_DAYS = 90
export const REP_MAX_TABLE_REPS = 15

export interface EstimateSet {
  weight: number | null
  reps: number | null
  performedOn: string
}

export function brzycki(weight: number, reps: number): number {
  return (weight * 36) / (37 - reps)
}

export function repsToWeight(oneRm: number, reps: number): number {
  return (oneRm * (37 - reps)) / 36
}

export function roundTenth(value: number): number {
  return Math.round(value * 10) / 10
}

export function estimateWindowStart(on: string): string {
  const day = new Date(`${on}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - (ESTIMATE_WINDOW_DAYS - 1))
  return day.toISOString().slice(0, 10)
}

function qualifies(weight: number | null, reps: number | null, repCap = MAX_ESTIMATE_REPS): boolean {
  return weight != null && reps != null && weight > 0 && reps >= 1 && reps <= repCap
}

export function bestEstimate(
  sets: EstimateSet[],
  on: string,
  repCap = MAX_ESTIMATE_REPS
): { estimate: number, source: OneRepMaxSource } | null {
  const from = estimateWindowStart(on)
  let best: { estimate: number, source: OneRepMaxSource } | null = null
  for (const set of sets) {
    if (!qualifies(set.weight, set.reps, repCap) || set.performedOn < from || set.performedOn > on) continue
    const estimate = brzycki(set.weight!, set.reps!)
    const newerTie = best && estimate === best.estimate && set.performedOn > best.source.performedOn
    if (!best || estimate > best.estimate || newerTie) {
      best = { estimate, source: { weight: set.weight!, reps: set.reps!, performedOn: set.performedOn } }
    }
  }
  return best && { estimate: roundTenth(best.estimate), source: best.source }
}

export function repMaxTable(oneRm: number): { reps: number, weight: number }[] {
  return Array.from({ length: REP_MAX_TABLE_REPS }, (_, i) => (
    { reps: i + 1, weight: roundTenth(repsToWeight(oneRm, i + 1)) }
  ))
}

export function effectiveOneRepMax(
  result: OneRepMaxResult | null,
  override: { weight: number | null, reps: number | null },
  repCap = MAX_ESTIMATE_REPS
): number | null {
  if (qualifies(override.weight, override.reps, repCap)) return roundTenth(brzycki(override.weight!, override.reps!))
  return result?.estimate ?? null
}

export function estimateCacheKey(userId: number, exerciseId: number, on: string, repCap: number): string {
  return `one-rep-max:${userId}:${exerciseId}:${on}:${repCap}`
}

export function historyStampKey(stamp: HistoryStamp): string {
  return [stamp.sets, stamp.setsAt ?? '0', stamp.sessionsAt ?? '0', stamp.entriesAt ?? '0'].join(':')
}
