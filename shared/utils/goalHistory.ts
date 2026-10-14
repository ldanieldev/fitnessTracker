export interface DatedSnapshot {
  effectiveFrom: string
}

/** The entry in force on `date`. Expects rows sorted by effectiveFrom, ascending. */
export function snapshotOn<T extends DatedSnapshot>(rows: T[], date: string): T | null {
  let found: T | null = null
  for (const row of rows) {
    if (row.effectiveFrom > date) break
    found = row
  }
  return found
}
