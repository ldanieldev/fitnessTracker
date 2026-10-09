export const CATALOGUE_FILE = 'drizzle/0003_workouts.sql'
export const CATALOGUE_BEGIN = '-- exercise-catalogue:begin'
export const CATALOGUE_END = '-- exercise-catalogue:end'

export function catalogueBounds(migration: string) {
  const start = migration.indexOf(CATALOGUE_BEGIN)
  const end = migration.indexOf(CATALOGUE_END)
  if (start < 0 || end < start) throw new Error(`${CATALOGUE_FILE} has no ${CATALOGUE_BEGIN} … ${CATALOGUE_END} block`)
  return { start, end: end + CATALOGUE_END.length }
}
