interface CivilDate {
  year: number
  month: number
  day: number
}

export interface DailyValue {
  day: string
  value: number
}

export interface SleepSessionRow {
  googleId: string
  day: string
  startAt: Date
  endAt: Date
  mainSleep: boolean
  minutesAsleep: number
  minutesAwake: number
  minutesLight: number
  minutesDeep: number
  minutesRem: number
}

export interface RawHrvPoint {
  dailyHeartRateVariability?: { date: CivilDate; averageHeartRateVariabilityMilliseconds?: number }
}

export interface RawRestingHrPoint {
  dailyRestingHeartRate?: {
    date: CivilDate
    beatsPerMinute?: string
    dailyRestingHeartRateMetadata?: { calculationMethod?: string }
  }
}

export interface RawSleepPoint {
  name: string
  sleep?: {
    interval: { startTime: string; endTime: string; endUtcOffset?: string }
    summary?: { minutesAsleep?: string; minutesAwake?: string; stagesSummary?: { type: string; minutes?: string }[] }
    metadata?: { mainSleep?: boolean }
  }
}

export interface RawStepsRollup {
  civilStartTime: { date: CivilDate }
  steps?: { countSum?: string }
}

export interface RawWeightPoint {
  name?: string
  weight?: { weightGrams?: number | string }
  dataSource?: { application?: { googleWebClientId?: string } }
}

const pad = (n: number) => String(n).padStart(2, '0')

function civilDate(date: CivilDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`
}

function parseOffsetSeconds(raw: string | undefined): number {
  const seconds = raw ? Number(raw.replace(/s$/, '')) : 0
  return Number.isFinite(seconds) ? seconds : 0
}

export function localDay(utcIso: string, offset: string | undefined): string {
  return new Date(Date.parse(utcIso) + parseOffsetSeconds(offset) * 1000).toISOString().slice(0, 10)
}

export function mapHrv(points: RawHrvPoint[]): DailyValue[] {
  return points.flatMap((p) => {
    const d = p.dailyHeartRateVariability
    const value = d?.averageHeartRateVariabilityMilliseconds
    return d && typeof value === 'number' ? [{ day: civilDate(d.date), value }] : []
  })
}

export function mapRestingHr(points: RawRestingHrPoint[]): DailyValue[] {
  return points.flatMap((p) => {
    const d = p.dailyRestingHeartRate
    if (!d || d.dailyRestingHeartRateMetadata?.calculationMethod !== 'WITH_SLEEP') return []
    const value = Number(d.beatsPerMinute)
    return value > 0 ? [{ day: civilDate(d.date), value }] : []
  })
}

function stageMinutes(summary: NonNullable<RawSleepPoint['sleep']>['summary'], type: string): number {
  return Number(summary?.stagesSummary?.find((s) => s.type === type)?.minutes ?? 0)
}

export function mapSleepSessions(points: RawSleepPoint[]): SleepSessionRow[] {
  return points.flatMap((p) => {
    const s = p.sleep
    if (!s) return []
    return [
      {
        googleId: p.name,
        day: localDay(s.interval.endTime, s.interval.endUtcOffset),
        startAt: new Date(s.interval.startTime),
        endAt: new Date(s.interval.endTime),
        mainSleep: s.metadata?.mainSleep === true,
        minutesAsleep: Number(s.summary?.minutesAsleep ?? 0),
        minutesAwake: Number(s.summary?.minutesAwake ?? 0),
        minutesLight: stageMinutes(s.summary, 'LIGHT'),
        minutesDeep: stageMinutes(s.summary, 'DEEP'),
        minutesRem: stageMinutes(s.summary, 'REM')
      }
    ]
  })
}

export function sleepHours(sessions: SleepSessionRow[]): DailyValue[] {
  const minutes = new Map<string, number>()
  for (const s of sessions) if (s.mainSleep) minutes.set(s.day, (minutes.get(s.day) ?? 0) + s.minutesAsleep)
  return [...minutes]
    .filter(([, total]) => total > 0)
    .map(([day, total]) => ({ day, value: Math.round((total / 60) * 10) / 10 }))
}

export function mainSleepEnds(sessions: SleepSessionRow[]): Map<string, Date> {
  const ends = new Map<string, Date>()
  for (const s of sessions) {
    const current = ends.get(s.day)
    if (s.mainSleep && (!current || s.endAt > current)) ends.set(s.day, s.endAt)
  }
  return ends
}

export function mapSteps(points: RawStepsRollup[]): DailyValue[] {
  return points.flatMap((p) => {
    const value = Number(p.steps?.countSum ?? 0)
    return value > 0 ? [{ day: civilDate(p.civilStartTime.date), value }] : []
  })
}

export function lbsToGrams(lbs: number): number {
  return Math.round(lbs * 453.59237)
}

export function pickOwnPoint(
  points: RawWeightPoint[],
  clientId: string,
  grams: number
): { adopt: string | null; stale: string[] } {
  const ours = points.filter((p) => p.name && p.dataSource?.application?.googleWebClientId === clientId)
  const match = ours.find((p) => Number(p.weight?.weightGrams) === grams)
  return {
    adopt: match?.name ?? null,
    stale: ours.filter((p) => p !== match).map((p) => p.name!)
  }
}
