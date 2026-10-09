import type { GraphMetric } from '../types/workout'
import { elapsedLabel } from './workoutTime'

const METERS_PER_MILE = 1609.344

const hundredth = (value: number) => Math.round(value * 100) / 100

export function metersToMiles(meters: number): number {
  return hundredth(meters / METERS_PER_MILE)
}

export function milesToMeters(miles: number): number {
  return hundredth(miles * METERS_PER_MILE)
}

const unknown = '—'

const isMeasure = (value: number) => Number.isFinite(value) && value >= 0

export function milesLabel(meters: number): string {
  return isMeasure(meters) ? `${metersToMiles(meters)} mi` : unknown
}

export function clockLabel(seconds: number): string {
  return isMeasure(seconds) ? elapsedLabel(Math.round(seconds)) : unknown
}

const MAX_CLOCK_SECONDS = 100 * 3600

// Bare digits read right to left (2530 → 25:30) because phone number pads have no ':' key.
export function parseClock(raw: string): number | null {
  const text = raw.trim()
  if (/^\d+$/.test(text)) {
    const seconds = Number(text.slice(-2))
    const minutes = Number(text.slice(-4, -2) || 0)
    const hours = Number(text.slice(0, -4) || 0)
    return withinClock(hours, minutes, seconds)
  }
  const match = /^(\d+):(\d{0,2})(?::(\d{0,2}))?$/.exec(text)
  if (!match) return null
  if (match[3] !== undefined && match[2] === '') return null
  const first = Number(match[1])
  const second = Number(match[2] || 0)
  if (match[3] === undefined) return withinClock(0, first, second)
  return withinClock(first, second, Number(match[3] || 0))
}

function withinClock(hours: number, minutes: number, seconds: number): number | null {
  if (seconds >= 60 || (hours > 0 && minutes >= 60)) return null
  const total = hours * 3600 + minutes * 60 + seconds
  return total > MAX_CLOCK_SECONDS ? null : total
}

export function secondsPerMile(metersPerSecond: number): number {
  return METERS_PER_MILE / metersPerSecond
}

export function paceFromSecondsPerMile(seconds: number): number {
  return METERS_PER_MILE / seconds
}

interface CardioDisplay {
  unit: string
  label: string
  toDisplay: (stored: number) => number
  format: (display: number) => string
}

const minutesClock = (minutes: number) => clockLabel(minutes * 60)

export function cardioMetricDisplay(metric: GraphMetric): CardioDisplay | null {
  if (metric === 'distance') {
    return {
      unit: 'mi',
      label: 'mi',
      toDisplay: (meters) => meters / METERS_PER_MILE,
      format: (miles) => (isMeasure(miles) ? String(hundredth(miles)) : unknown)
    }
  }
  if (metric === 'duration')
    return { unit: '', label: 'm:ss', toDisplay: (seconds) => seconds / 60, format: minutesClock }
  if (metric === 'pace') {
    return { unit: '/mi', label: 'min/mi', toDisplay: (speed) => secondsPerMile(speed) / 60, format: minutesClock }
  }
  return null
}
