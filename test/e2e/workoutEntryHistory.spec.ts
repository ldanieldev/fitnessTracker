import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Exercise, ExerciseCategory, WorkoutSession } from '../../shared/types/workout'

type Page = Parameters<typeof apiFetch>[0]

async function exercise(page: Page) {
  const chest = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference'))
    .json.categories.find((c) => c.key === 'chest')!
  return (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('History Test '), categoryId: chest.id, trackingType: 'weight_reps', loadStyle: 'plain'
  })).json
}

async function session(page: Page, performedOn: string, exerciseIds: number[]) {
  let current = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
  for (const exerciseId of exerciseIds) {
    current = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${current.id}/entries`, { exerciseId })).json
  }
  return current
}

const log = (page: Page, entryId: number, weight: number, reps: number) =>
  apiFetch(page, 'POST', `/api/workouts/entries/${entryId}/sets`, { weight, reps })
const finish = (page: Page, id: number) => apiFetch(page, 'PATCH', `/api/workouts/sessions/${id}`, { finish: true })
const get = async (page: Page, id: number) => (await apiFetch<WorkoutSession>(page, 'GET', `/api/workouts/sessions/${id}`)).json
const records = (s: WorkoutSession) => s.entries.map((e) => e.sets.map((set) => set.records))

test('a session reads records and last time from earlier sessions only, including the same exercise twice', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const [a, b] = [await exercise(page), await exercise(page)]

  const s1 = await session(page, '2026-01-05', [a.id])
  await log(page, s1.entries[0]!.id, 100, 5)
  await log(page, s1.entries[0]!.id, 100, 5)
  await finish(page, s1.id)

  const s2 = await session(page, '2026-01-12', [a.id, b.id])
  await log(page, s2.entries[1]!.id, 50, 10)
  await finish(page, s2.id)

  const s3 = await session(page, '2026-01-19', [a.id])
  await log(page, s3.entries[0]!.id, 110, 5)
  await finish(page, s3.id)

  const s4 = await session(page, '2026-01-26', [a.id, a.id])
  const [first, second] = s4.entries.map((e) => e.id) as [number, number]
  await log(page, first, 105, 5)
  await log(page, second, 115, 5)
  await log(page, first, 120, 5)

  const now = await get(page, s4.id)
  expect(records(now)).toEqual([
    [[], [{ kind: 'weight_reps', previous: 115 }]],
    [[{ kind: 'weight_reps', previous: 110 }]]
  ])
  expect(now.entries.map((e) => e.lastSets)).toEqual([[{ weight: 110, reps: 5 }], [{ weight: 110, reps: 5 }]])
  await finish(page, s4.id)

  const third = await get(page, s3.id)
  expect(records(third)).toEqual([[[{ kind: 'weight_reps', previous: 100 }]]])
  expect(third.entries[0]!.lastSets).toEqual([{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }])

  const firstSession = await get(page, s1.id)
  expect(records(firstSession)).toEqual([[[], []]])
  expect(firstSession.entries[0]!.lastSets).toEqual([])

  const second2 = await get(page, s2.id)
  expect(second2.entries.map((e) => e.lastSets)).toEqual([[{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }], []])
  expect(records(second2)).toEqual([[], [[]]])
})

test('two sessions on the same day order by start, so the later one reads the earlier one\'s heavier sets', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await exercise(page)

  const morning = await session(page, '2026-02-02', [a.id])
  await log(page, morning.entries[0]!.id, 120, 5)
  await finish(page, morning.id)

  const evening = await session(page, '2026-02-02', [a.id])
  await log(page, evening.entries[0]!.id, 110, 5)
  await log(page, evening.entries[0]!.id, 125, 5)

  const later = await get(page, evening.id)
  expect(records(later)).toEqual([[[], [{ kind: 'weight_reps', previous: 120 }]]])
  expect(later.entries[0]!.lastSets).toEqual([{ weight: 120, reps: 5 }])

  const earlier = await get(page, morning.id)
  expect(records(earlier)).toEqual([[[]]])
  expect(earlier.entries[0]!.lastSets).toEqual([])
})

const EXPECTED_SHAPE = {
  id: 'session',
  name: null,
  performedOn: '2026-02-16',
  startedAt: 'startedAt',
  endedAt: null,
  notes: null,
  routineDayId: null,
  deload: false,
  entries: [
    {
      id: 'entry0',
      exerciseId: 'barbell',
      exerciseName: 'barbell',
      sortOrder: 0,
      trackingType: 'weight_reps',
      loadStyle: 'barbell',
      barWeight: 35,
      weightIncrement: 2.5,
      restSeconds: 90,
      plateSizes: [45, 35, 25, 10, 5, 2.5],
      notes: null,
      target: null,
      supersetGroup: 1,
      optional: false,
      restOverrideSeconds: null,
      sets: [
        {
          id: 'set0',
          sortOrder: 0,
          weight: 155,
          reps: 5,
          distanceMeters: null,
          durationSeconds: null,
          done: true,
          comment: 'tough',
          records: [{ kind: 'weight_reps', previous: 145 }]
        },
        {
          id: 'set1',
          sortOrder: 1,
          weight: 150,
          reps: 3,
          distanceMeters: null,
          durationSeconds: null,
          done: false,
          comment: null,
          records: []
        }
      ],
      lastSets: [{ weight: 150, reps: 3 }, { weight: 152.5, reps: 2 }]
    },
    {
      id: 'entry1',
      exerciseId: 'assisted',
      exerciseName: 'assisted',
      sortOrder: 1,
      trackingType: 'weight_reps',
      loadStyle: 'assisted',
      barWeight: null,
      weightIncrement: null,
      restSeconds: null,
      plateSizes: null,
      notes: null,
      target: null,
      supersetGroup: 1,
      optional: false,
      restOverrideSeconds: null,
      sets: [
        {
          id: 'set2',
          sortOrder: 0,
          weight: 30,
          reps: 6,
          distanceMeters: null,
          durationSeconds: null,
          done: false,
          comment: null,
          records: [{ kind: 'weight_reps', previous: 40 }]
        },
        {
          id: 'set3',
          sortOrder: 1,
          weight: 45,
          reps: 6,
          distanceMeters: null,
          durationSeconds: null,
          done: false,
          comment: null,
          records: []
        }
      ],
      lastSets: [{ weight: 40, reps: 6 }]
    },
    {
      id: 'entry2',
      exerciseId: 'cardio',
      exerciseName: 'cardio',
      sortOrder: 2,
      trackingType: 'distance_time',
      loadStyle: null,
      barWeight: null,
      weightIncrement: null,
      restSeconds: null,
      plateSizes: null,
      notes: 'easy pace',
      target: null,
      supersetGroup: null,
      optional: false,
      restOverrideSeconds: null,
      sets: [
        {
          id: 'set4',
          sortOrder: 0,
          weight: null,
          reps: null,
          distanceMeters: 6000,
          durationSeconds: 1800,
          done: false,
          comment: null,
          records: [{ kind: 'distance', previous: 5000 }, { kind: 'pace', previous: 3.0773076923076923 }]
        },
        {
          id: 'set5',
          sortOrder: 1,
          weight: null,
          reps: null,
          distanceMeters: 3000,
          durationSeconds: 1100,
          done: false,
          comment: null,
          records: []
        }
      ],
      lastSets: [{ distanceMeters: 4000.5, durationSeconds: 1300 }]
    },
    {
      id: 'entry3',
      exerciseId: 'plain',
      exerciseName: 'plain',
      sortOrder: 3,
      trackingType: 'weight_reps',
      loadStyle: 'plain',
      barWeight: null,
      weightIncrement: null,
      restSeconds: null,
      plateSizes: null,
      notes: null,
      target: null,
      supersetGroup: null,
      optional: false,
      restOverrideSeconds: null,
      sets: [
        {
          id: 'set6',
          sortOrder: 0,
          weight: 22.5,
          reps: 10,
          distanceMeters: null,
          durationSeconds: null,
          done: false,
          comment: null,
          records: []
        }
      ],
      lastSets: []
    },
    {
      id: 'entry4',
      exerciseId: 'barbell',
      exerciseName: 'barbell',
      sortOrder: 4,
      trackingType: 'weight_reps',
      loadStyle: 'barbell',
      barWeight: 35,
      weightIncrement: 2.5,
      restSeconds: 90,
      plateSizes: [45, 35, 25, 10, 5, 2.5],
      notes: null,
      target: null,
      supersetGroup: null,
      optional: false,
      restOverrideSeconds: null,
      sets: [
        {
          id: 'set7',
          sortOrder: 0,
          weight: 162.5,
          reps: 1,
          distanceMeters: null,
          durationSeconds: null,
          done: false,
          comment: null,
          records: []
        },
        {
          id: 'set8',
          sortOrder: 1,
          weight: 160,
          reps: 2,
          distanceMeters: null,
          durationSeconds: null,
          done: false,
          comment: null,
          records: [{ kind: 'weight_reps', previous: 155 }]
        }
      ],
      lastSets: [{ weight: 150, reps: 3 }, { weight: 152.5, reps: 2 }]
    }
  ]
}

function normalize(loaded: WorkoutSession, names: Map<number, string>) {
  const setIds = new Map<number, string>()
  return {
    ...loaded,
    id: 'session',
    startedAt: 'startedAt',
    entries: loaded.entries.map((entry, index) => ({
      ...entry,
      id: `entry${index}`,
      exerciseId: names.get(entry.exerciseId),
      exerciseName: names.get(entry.exerciseId),
      sets: entry.sets.map((set) => {
        setIds.set(set.id, setIds.get(set.id) ?? `set${setIds.size}`)
        return { ...set, id: setIds.get(set.id) }
      })
    }))
  }
}

test('a loaded session keeps its full shape across supersets, cardio, assisted and a repeated exercise', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const chest = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference'))
    .json.categories.find((c) => c.key === 'chest')!
  const create = async (body: Record<string, unknown>) => (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Shape Test '), categoryId: chest.id, ...body
  })).json
  const barbell = await create({ trackingType: 'weight_reps', loadStyle: 'barbell', barWeight: 45 })
  const assisted = await create({ trackingType: 'weight_reps', loadStyle: 'assisted' })
  const cardio = await create({ trackingType: 'distance_time' })
  const plain = await create({ trackingType: 'weight_reps', loadStyle: 'plain' })
  const names = new Map([[barbell.id, 'barbell'], [assisted.id, 'assisted'], [cardio.id, 'cardio'], [plain.id, 'plain']])
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${barbell.id}/prefs`, { barWeight: 35, weightIncrement: 2.5, restSeconds: 90 })

  const addSet = (entryId: number, body: Record<string, unknown>) =>
    apiFetch(page, 'POST', `/api/workouts/entries/${entryId}/sets`, body)

  const early = await session(page, '2026-02-02', [barbell.id, assisted.id, cardio.id])
  await addSet(early.entries[0]!.id, { weight: 135, reps: 5 })
  await addSet(early.entries[0]!.id, { weight: 145, reps: 5 })
  await addSet(early.entries[1]!.id, { weight: 40, reps: 6 })
  await addSet(early.entries[2]!.id, { distanceMeters: 5000, durationSeconds: 1800 })
  await finish(page, early.id)

  const prior = await session(page, '2026-02-09', [barbell.id, cardio.id])
  await addSet(prior.entries[0]!.id, { weight: 150, reps: 3 })
  await addSet(prior.entries[0]!.id, { weight: 152.5, reps: 2 })
  await addSet(prior.entries[1]!.id, { distanceMeters: 4000.5, durationSeconds: 1300 })
  await finish(page, prior.id)

  const later = await session(page, '2026-02-23', [barbell.id])
  await addSet(later.entries[0]!.id, { weight: 300, reps: 5 })
  await finish(page, later.id)

  const main = await session(page, '2026-02-16', [barbell.id, assisted.id, cardio.id, plain.id, barbell.id])
  const ids = main.entries.map((e) => e.id)
  await apiFetch(page, 'POST', `/api/workouts/sessions/${main.id}/group`, { entryIds: ids.slice(0, 2) })
  await apiFetch(page, 'PATCH', `/api/workouts/entries/${ids[2]}`, { notes: 'easy pace' })
  await addSet(ids[0]!, { weight: 155, reps: 5, done: true, comment: 'tough' })
  await addSet(ids[0]!, { weight: 150, reps: 3 })
  await addSet(ids[1]!, { weight: 30, reps: 6 })
  await addSet(ids[1]!, { weight: 45, reps: 6 })
  await addSet(ids[2]!, { distanceMeters: 6000, durationSeconds: 1800 })
  await addSet(ids[2]!, { distanceMeters: 3000, durationSeconds: 1100 })
  await addSet(ids[3]!, { weight: 22.5, reps: 10 })
  await addSet(ids[4]!, { weight: 162.5, reps: 1 })
  await addSet(ids[4]!, { weight: 160, reps: 2 })

  const loaded = normalize(await get(page, main.id), names)
  expect(loaded).toEqual(EXPECTED_SHAPE)
  expect(JSON.stringify(loaded)).toBe(JSON.stringify(EXPECTED_SHAPE))
})
