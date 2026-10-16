import type { DailyValue } from './map'

export interface ExistingRow {
  id: number
  day: string
  source: 'manual' | 'google'
}

export interface WritePlan {
  upserts: DailyValue[]
  deleteIds: number[]
}

export function planDaily(existing: ExistingRow[], fetched: DailyValue[]): WritePlan {
  const manualDays = new Set(existing.filter((r) => r.source === 'manual').map((r) => r.day))
  const upserts = fetched.filter((v) => !manualDays.has(v.day))
  const keep = new Set(upserts.map((v) => v.day))
  const deleteIds = existing.filter((r) => r.source === 'google' && !keep.has(r.day)).map((r) => r.id)
  return { upserts, deleteIds }
}
