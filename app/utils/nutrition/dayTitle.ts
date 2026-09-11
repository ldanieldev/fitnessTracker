const TITLE_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export function formatDayTitle(date: string): string {
  return TITLE_FORMAT.format(new Date(`${date}T00:00:00`))
}
