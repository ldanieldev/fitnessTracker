import { describe, expect, it } from 'vitest'
import {
  exactExerciseMatch,
  fitNotesCategoryKey,
  FitNotesParseError,
  parseAssist,
  parseCsvRows,
  parseFitNotesCsv,
  parseFitNotesTime,
  planFitNotesDays,
  setWeight,
  suggestExercises,
  summarizeFitNotes
} from '../../shared/utils/fitnotes'

const HEADER = 'Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment'

const EXPORT = [
  HEADER,
  '2026-09-29,Chin Up,Back,0.0,lbs,8,,,,"85lb assist"',
  '2026-09-29,Chin Up,Back,0.0,lbs,6,,,,"85lb assist"',
  '2026-09-29,Barbell Row,Back,185.0,lbs,5,,,,""',
  '2026-09-28,Flat Barbell Bench Press,Chest,150.0,lbs,6,,,,"slight fight, last rep"',
  '2026-09-28,Elliptical Trainer,Cardio,,,,1.25,mi,0:20:00,"Lvl 7"',
  '2026-10-06,Chin Up,Back,0.0,lbs,9,,,,"85lb assist"',
  '2026-10-06,Push Ups,Chest,0.0,lbs,15,,,,""',
  '2026-10-06,Barbell Row,Back,190.0,lbs,5,,,,""'
].join('\n')

describe('parseCsvRows', () => {
  it('handles quoted commas, doubled quotes, CRLF and a missing trailing newline', () => {
    expect(parseCsvRows('a,"b, c","say ""hi"""\r\n1,2,3')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3']
    ])
    expect(parseCsvRows('a,""\n\nb,c\n')).toEqual([
      ['a', ''],
      ['b', 'c']
    ])
  })

  it('keeps a line break inside a quoted field', () => {
    expect(parseCsvRows('"two\nlines",x')).toEqual([['two\nlines', 'x']])
  })
})

describe('parseFitNotesTime', () => {
  it('reads h:mm:ss, m:ss and bare seconds', () => {
    expect(parseFitNotesTime('0:20:00')).toBe(1200)
    expect(parseFitNotesTime('1:02:03')).toBe(3723)
    expect(parseFitNotesTime('2:30')).toBe(150)
    expect(parseFitNotesTime('45')).toBe(45)
    expect(parseFitNotesTime('')).toBeNull()
    expect(parseFitNotesTime('a:b')).toBeNull()
  })
})

describe('parseAssist', () => {
  it('reads the assist amount from a comment, in pounds', () => {
    expect(parseAssist('85lb assist', 'lbs')).toBe(85)
    expect(parseAssist('70 lbs assist, slow', 'lbs')).toBe(70)
    expect(parseAssist('20kg Assist', 'lbs')).toBe(44.09)
    expect(parseAssist('40 assist', 'kgs')).toBe(88.18)
    expect(parseAssist('Superset', 'lbs')).toBeNull()
    expect(parseAssist(null, 'lbs')).toBeNull()
  })
})

describe('parseFitNotesCsv', () => {
  it('parses each set, converting units and pulling the assist out of the comment', () => {
    const rows = parseFitNotesCsv(EXPORT)
    expect(rows).toHaveLength(8)
    expect(rows[0]).toEqual({
      date: '2026-09-29',
      exercise: 'Chin Up',
      category: 'Back',
      weight: 0,
      reps: 8,
      distanceMeters: null,
      durationSeconds: null,
      assist: 85,
      comment: '85lb assist'
    })
    expect(rows[3]!.comment).toBe('slight fight, last rep')
    expect(rows[2]!.comment).toBeNull()
    expect(rows[4]).toMatchObject({ weight: null, reps: null, distanceMeters: 2011.68, durationSeconds: 1200 })
  })

  it('converts kilograms to pounds and meters stay meters', () => {
    const rows = parseFitNotesCsv(
      [HEADER, '2026-01-01,Squat,Legs,100,kgs,5,,,,', '2026-01-01,Stair master,Cardio,,,,400,m,0:05:00,'].join('\n')
    )
    expect(rows[0]!.weight).toBe(220.46)
    expect(rows[1]!.distanceMeters).toBe(400)
  })

  it('accepts a byte-order mark before the header', () => {
    expect(parseFitNotesCsv(`\uFEFF${HEADER}\n2026-01-01,Squat,Legs,100,lbs,5,,,,`)).toHaveLength(1)
  })

  it('rejects a file that is not a FitNotes export, naming the line for bad rows', () => {
    expect(() => parseFitNotesCsv('Date,Workout,Exercise\n')).toThrow(FitNotesParseError)
    expect(() => parseFitNotesCsv('')).toThrow(FitNotesParseError)
    expect(() => parseFitNotesCsv(`${HEADER}\n10/04/2026,Squat,Legs,1,lbs,1,,,,`)).toThrow('Line 2: date')
    expect(() => parseFitNotesCsv(`${HEADER}\n2026-10-04,,Legs,1,lbs,1,,,,`)).toThrow('Line 2: exercise')
    expect(() => parseFitNotesCsv(`${HEADER}\n2026-10-04,Run,Cardio,,,,3,leagues,,`)).toThrow('distance unit')
  })
})

describe('summarizeFitNotes', () => {
  it('groups by exercise with set and day counts, date range, tracking type and assist', () => {
    const summary = summarizeFitNotes(parseFitNotesCsv(EXPORT))
    expect(summary.map((s) => s.name)).toEqual([
      'Chin Up',
      'Barbell Row',
      'Elliptical Trainer',
      'Flat Barbell Bench Press',
      'Push Ups'
    ])
    expect(summary[0]).toEqual({
      name: 'Chin Up',
      category: 'Back',
      sets: 3,
      days: 2,
      firstDate: '2026-09-29',
      lastDate: '2026-10-06',
      trackingType: 'weight_reps',
      assisted: true
    })
    expect(summary.find((s) => s.name === 'Elliptical Trainer')!.trackingType).toBe('distance_time')
    expect(summary.find((s) => s.name === 'Push Ups')!.trackingType).toBe('reps')
    expect(summary.find((s) => s.name === 'Barbell Row')).toMatchObject({
      trackingType: 'weight_reps',
      assisted: false
    })
  })

  it('types time-only and distance-only cardio', () => {
    const rows = parseFitNotesCsv(
      [HEADER, '2026-01-01,Plank,Abs,,,,,,0:01:00,', '2026-01-01,Walk,Cardio,,,,2,km,,'].join('\n')
    )
    const summary = summarizeFitNotes(rows)
    expect(summary.find((s) => s.name === 'Plank')!.trackingType).toBe('time')
    expect(summary.find((s) => s.name === 'Walk')!.trackingType).toBe('distance')
  })
})

describe('planFitNotesDays', () => {
  it('builds one day per date, oldest first, entries in first-seen order and sets in file order', () => {
    const days = planFitNotesDays(parseFitNotesCsv(EXPORT))
    expect(days.map((d) => d.date)).toEqual(['2026-09-28', '2026-09-29', '2026-10-06'])
    expect(days[1]!.entries.map((e) => e.exercise)).toEqual(['Chin Up', 'Barbell Row'])
    expect(days[1]!.entries[0]!.sets.map((s) => s.reps)).toEqual([8, 6])
    expect(days[2]!.entries.map((e) => e.exercise)).toEqual(['Chin Up', 'Push Ups', 'Barbell Row'])
  })
})

describe('setWeight', () => {
  const set = { weight: 0, reps: 8, distanceMeters: null, durationSeconds: null, assist: 85, comment: null }
  it('stores the assist as the weight of an assisted set and zero for a set without one', () => {
    expect(setWeight(set, 'weight_reps', true)).toBe(85)
    expect(setWeight({ ...set, assist: null }, 'weight_reps', true)).toBe(0)
  })
  it('keeps the logged weight otherwise and drops it for types without weight', () => {
    expect(setWeight({ ...set, weight: 185, assist: null }, 'weight_reps', false)).toBe(185)
    expect(setWeight(set, 'reps', false)).toBeNull()
    expect(setWeight(set, 'distance_time', false)).toBeNull()
  })
})

describe('fitNotesCategoryKey', () => {
  it('maps the FitNotes default categories onto the app categories', () => {
    expect(fitNotesCategoryKey('Abs')).toBe('core')
    expect(fitNotesCategoryKey('Biceps')).toBe('arms')
    expect(fitNotesCategoryKey('Triceps')).toBe('arms')
    expect(fitNotesCategoryKey('Forearms')).toBe('arms')
    expect(fitNotesCategoryKey('Cardio')).toBe('cardio')
    expect(fitNotesCategoryKey(' legs ')).toBe('legs')
    expect(fitNotesCategoryKey('Olympic')).toBeNull()
  })
})

describe('exercise matching', () => {
  const candidates = [
    { id: 1, name: 'Barbell Bench Press - Medium Grip', custom: false },
    { id: 2, name: 'Dumbbell Bench Press', custom: false },
    { id: 3, name: 'Ab Crunch Machine', custom: false },
    { id: 4, name: 'Ab Crunch Machine', custom: true },
    { id: 5, name: 'Pullups', custom: false },
    { id: 6, name: 'EZ-Bar Curl', custom: false },
    { id: 7, name: 'Leg Press', custom: false }
  ]

  it('matches a name exactly, ignoring case, preferring the user’s own exercise', () => {
    expect(exactExerciseMatch('ab crunch machine', candidates)?.id).toBe(4)
    expect(exactExerciseMatch('Leg Press', candidates)?.id).toBe(7)
    expect(exactExerciseMatch('Flat Barbell Bench Press', candidates)).toBeNull()
  })

  it('suggests close names by shared words, best first', () => {
    expect(suggestExercises('Flat Barbell Bench Press', candidates).map((c) => c.id)).toEqual([1, 2])
    expect(suggestExercises('Flat Dumbbell Bench Press', candidates)[0]!.id).toBe(2)
    expect(suggestExercises('EZ Bar Curl', candidates).map((c) => c.id)).toEqual([6])
    expect(suggestExercises('Stair master', candidates)).toEqual([])
    expect(suggestExercises('Pull Up', candidates)[0]!.id).toBe(5)
  })
})
