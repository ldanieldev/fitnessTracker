function formatDate(date: Date, withYear: boolean) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: withYear ? 'numeric' : undefined
  }).format(date)
}

export function formatRange(start: Date, end: Date | undefined, today: Date) {
  if (!end) return formatDate(start, start.getFullYear() !== today.getFullYear())

  const withYear = start.getFullYear() !== today.getFullYear() || end.getFullYear() !== today.getFullYear()
  return `${formatDate(start, withYear)} – ${formatDate(end, withYear)}`
}
