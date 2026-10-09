import type { SessionFilter } from '../types/workout'

function positiveInt(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return undefined
  const value = Number(raw)
  return value > 0 ? value : undefined
}

function nonNegative(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

function normalized(filter: SessionFilter): SessionFilter {
  const out: SessionFilter = {}
  if (filter.from) out.from = filter.from
  if (filter.to) out.to = filter.to
  const categories = [...new Set(filter.categories ?? [])].sort((a, b) => a - b)
  if (categories.length) {
    out.categories = categories
    if (filter.match === 'all' && categories.length > 1) out.match = 'all'
  }
  if (filter.exerciseId) {
    out.exerciseId = filter.exerciseId
    if (filter.minWeight !== undefined) out.minWeight = filter.minWeight
    if (filter.minReps !== undefined) out.minReps = filter.minReps
  }
  if (filter.programId) {
    out.programId = filter.programId
    if (filter.phaseId) out.phaseId = filter.phaseId
  }
  return out
}

export function sessionFilterParams(filter: SessionFilter): string {
  const f = normalized(filter)
  const params = new URLSearchParams()
  if (f.from) params.set('from', f.from)
  if (f.to) params.set('to', f.to)
  if (f.categories) params.set('categories', f.categories.join(','))
  if (f.match) params.set('match', f.match)
  if (f.exerciseId) params.set('exerciseId', String(f.exerciseId))
  if (f.minWeight !== undefined) params.set('minWeight', String(f.minWeight))
  if (f.minReps !== undefined) params.set('minReps', String(f.minReps))
  if (f.programId) params.set('programId', String(f.programId))
  if (f.phaseId) params.set('phaseId', String(f.phaseId))
  return params.toString()
}

export function filterFromRoute(query: Record<string, unknown>): SessionFilter {
  const categories =
    typeof query.cat === 'string'
      ? query.cat
          .split(',')
          .map(positiveInt)
          .filter((id): id is number => id !== undefined)
      : []
  const minReps = positiveInt(query.r)
  return normalized({
    categories,
    match: query.match === 'all' ? 'all' : 'any',
    exerciseId: positiveInt(query.ex),
    minWeight: nonNegative(query.w),
    minReps,
    programId: positiveInt(query.prog),
    phaseId: positiveInt(query.phase)
  })
}

export function filterToRoute(filter: SessionFilter): Record<string, string> {
  const f = normalized(filter)
  const route: Record<string, string> = {}
  if (f.categories) route.cat = f.categories.join(',')
  if (f.match) route.match = f.match
  if (f.exerciseId) route.ex = String(f.exerciseId)
  if (f.minWeight !== undefined) route.w = String(f.minWeight)
  if (f.minReps !== undefined) route.r = String(f.minReps)
  if (f.programId) route.prog = String(f.programId)
  if (f.phaseId) route.phase = String(f.phaseId)
  return route
}

export function activeFilterCount(filter: SessionFilter): number {
  const f = normalized(filter)
  return (f.categories ? 1 : 0) + (f.exerciseId ? 1 : 0) + (f.programId ? 1 : 0)
}
