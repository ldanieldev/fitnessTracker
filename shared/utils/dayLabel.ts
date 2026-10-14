const DAY_LABEL = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
})

export function formatDayLabel(date: string): string {
  return DAY_LABEL.format(new Date(`${date}T00:00:00Z`))
}
