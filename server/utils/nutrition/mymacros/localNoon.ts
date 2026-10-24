export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(at)
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value)
  const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
  return wall - at.getTime()
}

/** The instant that is 12:00 on `date` (YYYY-MM-DD) in the IANA `timeZone`. */
export function localNoon(date: string, timeZone: string): Date {
  const noonUtc = Date.parse(`${date}T12:00:00Z`)
  // The offset is sampled at a guess first; a second pass corrects a guess that fell on the other side of a DST change.
  const guess = noonUtc - offsetMs(new Date(noonUtc), timeZone)
  return new Date(noonUtc - offsetMs(new Date(guess), timeZone))
}
