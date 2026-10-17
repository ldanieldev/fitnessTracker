import type { TrackingType } from '../types/workout'
import { isCalendarDate } from './calendarDate'
import { SET_LIMITS } from './setRules'

const FITNOTES_HEADER = [
  'Date',
  'Exercise',
  'Category',
  'Weight',
  'Weight Unit',
  'Reps',
  'Distance',
  'Distance Unit',
  'Time',
  'Comment'
] as const

const LB_PER_KG = 2.20462
const METERS_PER_UNIT: Record<string, number> = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048, yd: 0.9144 }
// The unit group owns its trailing spaces so the two \s* runs can't trade spaces (that backtracked quadratically).
const ASSIST = /\b(\d+(?:\.\d+)?)\s*(?:(lbs?|kgs?)\s*)?assist\b/i
const ASSIST_COMMENT_MAX = 500

export const FITNOTES_LIMITS = {
  rows: 200_000,
  exercises: 2_000,
  categories: 200,
  exerciseName: 255,
  category: 64,
  comment: 2_000
} as const

export class FitNotesParseError extends Error {}

export interface FitNotesSet {
  weight: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
  assist: number | null
  comment: string | null
}

export interface FitNotesRow extends FitNotesSet {
  date: string
  exercise: string
  category: string
}

export interface FitNotesExerciseSummary {
  name: string
  category: string
  sets: number
  days: number
  firstDate: string
  lastDate: string
  trackingType: TrackingType
  assisted: boolean
}

export interface FitNotesEntryPlan {
  exercise: string
  sets: FitNotesSet[]
}

export interface FitNotesDayPlan {
  date: string
  entries: FitNotesEntryPlan[]
}

export interface ExerciseCandidate {
  id: number
  name: string
  custom: boolean
}

/** RFC 4180 rows: quoted fields may hold commas, doubled quotes and line breaks. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

function num(raw: string | undefined): number | null {
  const text = raw?.trim() ?? ''
  if (text === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

function round(value: number, places = 2): number {
  const f = 10 ** places
  return Math.round(value * f) / f
}

function toPounds(value: number, unit: string): number {
  return /^kgs?$/i.test(unit.trim()) ? round(value * LB_PER_KG) : value
}

export function parseFitNotesTime(raw: string): number | null {
  const text = raw.trim()
  if (text === '') return null
  const parts = text.split(':').map(Number)
  if (parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0)) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}

export function parseAssist(comment: string | null, weightUnit: string): number | null {
  if (!comment || comment.length > ASSIST_COMMENT_MAX) return null
  const match = comment.match(ASSIST)
  if (!match) return null
  return toPounds(Number(match[1]), match[2] ?? weightUnit)
}

function isFitNotesHeader(cells: string[]): boolean {
  return FITNOTES_HEADER.every((name, i) => cells[i]?.trim().replace(/^\uFEFF/, '') === name)
}

function checkRange(line: number, label: string, value: number | null, max: number, integer = false): void {
  if (value === null) return
  if (value < 0 || value > max || (integer && !Number.isInteger(value))) {
    throw new FitNotesParseError(`Line ${line}: ${label} must be ${integer ? 'a whole number ' : ''}from 0 to ${max}`)
  }
}

export function parseFitNotesCsv(text: string): FitNotesRow[] {
  const [header, ...body] = parseCsvRows(text)
  if (!header || !isFitNotesHeader(header)) {
    throw new FitNotesParseError('Not a FitNotes export: the first line must be the FitNotes CSV header')
  }
  if (body.length > FITNOTES_LIMITS.rows) {
    throw new FitNotesParseError(`The export has more than ${FITNOTES_LIMITS.rows} sets; split it into smaller files`)
  }
  const names = new Set<string>()
  const categories = new Set<string>()
  return body.map((cells, index) => {
    const line = index + 2
    const [date, exercise, category, weight, weightUnit, reps, distance, distanceUnit, time, comment] = cells.map((c) =>
      c.trim()
    )
    if (!date || !isCalendarDate(date)) {
      throw new FitNotesParseError(`Line ${line}: date must be a real YYYY-MM-DD date`)
    }
    if (!exercise) throw new FitNotesParseError(`Line ${line}: exercise name is missing`)
    if (exercise.length > FITNOTES_LIMITS.exerciseName) {
      const max = FITNOTES_LIMITS.exerciseName
      throw new FitNotesParseError(`Line ${line}: exercise name is longer than ${max} characters`)
    }
    if ((category ?? '').length > FITNOTES_LIMITS.category) {
      throw new FitNotesParseError(`Line ${line}: category is longer than ${FITNOTES_LIMITS.category} characters`)
    }
    if ((comment ?? '').length > FITNOTES_LIMITS.comment) {
      throw new FitNotesParseError(`Line ${line}: comment is longer than ${FITNOTES_LIMITS.comment} characters`)
    }
    names.add(exercise)
    if (names.size > FITNOTES_LIMITS.exercises) {
      throw new FitNotesParseError(`Line ${line}: the export has more than ${FITNOTES_LIMITS.exercises} exercises`)
    }
    categories.add((category ?? '').toLowerCase())
    if (categories.size > FITNOTES_LIMITS.categories) {
      throw new FitNotesParseError(`Line ${line}: the export has more than ${FITNOTES_LIMITS.categories} categories`)
    }
    const distanceValue = num(distance)
    const unit = (distanceUnit ?? '').toLowerCase()
    if (distanceValue !== null && !Object.hasOwn(METERS_PER_UNIT, unit)) {
      throw new FitNotesParseError(`Line ${line}: unknown distance unit "${distanceUnit}"`)
    }
    const weightValue = num(weight)
    const pounds = weightValue === null ? null : toPounds(weightValue, weightUnit ?? '')
    const note = comment ? comment : null
    const seconds = parseFitNotesTime(time ?? '')
    const row: FitNotesRow = {
      date,
      exercise,
      category: category ?? '',
      weight: pounds !== null && pounds < 0 ? 0 : pounds,
      reps: num(reps),
      distanceMeters: distanceValue === null ? null : round(distanceValue * METERS_PER_UNIT[unit]!),
      durationSeconds: seconds === null ? null : Math.round(seconds),
      assist: pounds !== null && pounds < 0 ? -pounds : parseAssist(note, weightUnit ?? ''),
      comment: note
    }
    checkRange(line, 'weight (lbs)', row.weight, SET_LIMITS.weight)
    checkRange(line, 'assist (lbs)', row.assist, SET_LIMITS.weight)
    checkRange(line, 'reps', row.reps, SET_LIMITS.reps, true)
    checkRange(line, 'distance (m)', row.distanceMeters, SET_LIMITS.distanceMeters)
    checkRange(line, 'time (seconds)', row.durationSeconds, SET_LIMITS.durationSeconds)
    return row
  })
}

function trackingTypeOf(rows: FitNotesRow[]): TrackingType {
  const distance = rows.some((r) => r.distanceMeters !== null)
  const time = rows.some((r) => r.durationSeconds !== null)
  const weighted = rows.some((r) => (r.weight ?? 0) !== 0 || r.assist !== null)
  const reps = rows.some((r) => r.reps !== null)
  if (distance && time) return 'distance_time'
  if (distance || time) {
    if (weighted) return distance ? 'weight_distance' : 'weight_time'
    if (reps) return distance ? 'reps_distance' : 'reps_time'
    return distance ? 'distance' : 'time'
  }
  return weighted ? 'weight_reps' : 'reps'
}

/** True when every measure the export logged fits the exercise's type, so a mapped entry can keep that type. */
export function fitsTrackingType(data: TrackingType, exercise: TrackingType): boolean {
  const have = new Set(exercise.split('_'))
  return data.split('_').every((measure) => have.has(measure))
}

export function summarizeFitNotes(rows: FitNotesRow[]): FitNotesExerciseSummary[] {
  const byName = new Map<string, FitNotesRow[]>()
  for (const row of rows) {
    const group = byName.get(row.exercise)
    if (group) group.push(row)
    else byName.set(row.exercise, [row])
  }
  return [...byName.entries()]
    .map(([name, group]) => {
      const dates = new Set(group.map((r) => r.date))
      let firstDate = group[0]!.date
      let lastDate = firstDate
      for (const date of dates) {
        if (date < firstDate) firstDate = date
        if (date > lastDate) lastDate = date
      }
      return {
        name,
        category: group[0]!.category,
        sets: group.length,
        days: dates.size,
        firstDate,
        lastDate,
        trackingType: trackingTypeOf(group),
        assisted: group.some((r) => r.assist !== null)
      }
    })
    .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name))
}

export function planFitNotesDays(rows: FitNotesRow[]): FitNotesDayPlan[] {
  const days = new Map<string, Map<string, FitNotesSet[]>>()
  for (const { date, exercise, category: _category, ...set } of rows) {
    let entries = days.get(date)
    if (!entries) {
      entries = new Map<string, FitNotesSet[]>()
      days.set(date, entries)
    }
    const sets = entries.get(exercise)
    if (sets) sets.push(set)
    else entries.set(exercise, [set])
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => ({
      date,
      entries: [...entries.entries()].map(([exercise, sets]) => ({ exercise, sets }))
    }))
}

/** The set as the app stores it: assisted sets carry the assist as their weight. */
export function setWeight(set: FitNotesSet, trackingType: TrackingType, assisted: boolean): number | null {
  if (!trackingType.includes('weight')) return null
  if (assisted) return set.assist ?? 0
  return set.weight ?? 0
}

const FITNOTES_CATEGORY_KEYS: Record<string, string> = {
  abs: 'core',
  core: 'core',
  back: 'back',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  arms: 'arms',
  cardio: 'cardio',
  chest: 'chest',
  legs: 'legs',
  shoulders: 'shoulders',
  neck: 'neck'
}

export function fitNotesCategoryKey(category: string): string | null {
  return FITNOTES_CATEGORY_KEYS[category.trim().toLowerCase()] ?? null
}

const SYNONYMS: Record<string, string> = {
  db: 'dumbbell',
  bb: 'barbell',
  ez: 'ezbar',
  flye: 'fly',
  flyes: 'fly',
  flys: 'fly',
  flies: 'fly'
}
// FitNotes says "flat" for the default bench, which catalogue names leave unsaid.
const STOPWORDS = new Set(['flat', 'the', 'with', 'on'])
// A variant word the FitNotes name lacks points at a different movement, so it costs double; equipment costs half.
const VARIANTS = new Set([
  'incline',
  'decline',
  'wide',
  'close',
  'narrow',
  'reverse',
  'seated',
  'standing',
  'lying',
  'kneeling',
  'single',
  'one',
  'alternating',
  'hammer',
  'smith',
  'sumo',
  'car',
  'axle',
  'deficit',
  'guillotine',
  'stiff',
  'leverage'
])

const EQUIPMENT = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'band', 'bodyweight'])

function tokens(name: string): Set<string> {
  const words = name
    .toLowerCase()
    .replace(/ez-bar/g, 'ezbar')
    .replace(/([a-z]+)[\s-]+ups?\b/g, '$1up')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map((w) => SYNONYMS[w] ?? (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
  return new Set(words)
}

export function exactExerciseMatch(name: string, candidates: ExerciseCandidate[]): ExerciseCandidate | null {
  const key = name.trim().toLowerCase()
  const hits = candidates.filter((c) => c.name.trim().toLowerCase() === key)
  return hits.find((c) => c.custom) ?? hits[0] ?? null
}

// A preview suggests for every export name against the same candidate list, so its tokens are computed once per list.
const candidateTokens = new WeakMap<ExerciseCandidate[], Set<string>[]>()

function tokensOf(candidates: ExerciseCandidate[]): Set<string>[] {
  let cached = candidateTokens.get(candidates)
  if (!cached) {
    cached = candidates.map((c) => tokens(c.name))
    candidateTokens.set(candidates, cached)
  }
  return cached
}

export function suggestExercises(name: string, candidates: ExerciseCandidate[], limit = 3): ExerciseCandidate[] {
  const wanted = tokens(name)
  const haves = tokensOf(candidates)
  return candidates
    .map((candidate, i) => {
      const have = haves[i]!
      const shared = [...wanted].filter((t) => have.has(t)).length
      const extra = [...have].filter((t) => !wanted.has(t))
      const variants = extra.filter((t) => VARIANTS.has(t)).length
      const cost = extra.reduce((sum, t) => sum + (VARIANTS.has(t) ? 2 : EQUIPMENT.has(t) ? 0.5 : 1), 0)
      return { candidate, variants, score: shared / (wanted.size + cost) }
    })
    .filter((s) => s.score >= 0.4)
    .sort((a, b) => b.score - a.score || a.variants - b.variants || a.candidate.name.length - b.candidate.name.length)
    .slice(0, limit)
    .map((s) => s.candidate)
}
