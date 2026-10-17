const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** A `YYYY-MM-DD` string naming a day that exists (rejects `2026-02-30`, `2026-10-99`). */
export function isCalendarDate(raw: string): boolean {
  if (!ISO_DATE.test(raw)) return false
  const parsed = new Date(`${raw}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw
}
