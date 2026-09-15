export function enumerateDates(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  if (start > end) {
    throw new Error('from must be before to')
  }
  const out: string[] = []
  for (const d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function todayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function rollingAverage(series: (number | null)[], window: number): (number | null)[] {
  return series.map((_, i) => {
    if (i + 1 < window) return null
    const slice = series.slice(i + 1 - window, i + 1).filter((v): v is number => v !== null)
    return slice.length === 0 ? null : slice.reduce((a, b) => a + b, 0) / slice.length
  })
}
