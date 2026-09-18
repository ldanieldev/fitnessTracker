export function durationLabel(startedAt: string, end: number): string {
  const seconds = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`
}

// <input type="datetime-local"> speaks local wall time with no zone; the API speaks UTC ISO.
export function toLocalInput(iso: string): string {
  const at = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

export function fromLocalInput(value: string): string | null {
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}
