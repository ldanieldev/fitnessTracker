import type { EntryTarget } from '~~/shared/types/workout'

interface TargetRow {
  targetSets: number | null
  targetLow: string | null
  targetHigh: string | null
  targetWeight: string | null
}

const fromNumeric = (value: string | null) => (value === null ? null : Number(value))
const toNumeric = (value: number | null | undefined) => (value == null ? null : String(value))

export function toEntryTarget(row: TargetRow): EntryTarget | null {
  if (row.targetSets === null && row.targetLow === null && row.targetHigh === null && row.targetWeight === null)
    return null
  return {
    sets: row.targetSets,
    low: fromNumeric(row.targetLow),
    high: fromNumeric(row.targetHigh),
    weight: fromNumeric(row.targetWeight)
  }
}

export function targetColumns(target: EntryTarget | null): TargetRow {
  return {
    targetSets: target?.sets ?? null,
    targetLow: toNumeric(target?.low),
    targetHigh: toNumeric(target?.high),
    targetWeight: toNumeric(target?.weight)
  }
}
