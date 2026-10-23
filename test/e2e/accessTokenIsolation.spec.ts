import type { APIRequestContext, Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, tokenFetch, uniquePrefix } from './helpers'
import type { Routine } from '../../shared/types/routine'
import type { Program } from '../../shared/types/program'
import type { WorkoutSession } from '../../shared/types/workout'
import { todayDate } from '../../shared/utils/nutritionSummary'

interface Case {
  name: string
  method: string
  path: string
  body?: unknown
}

interface Container {
  id: number
}

async function newToken(page: Page) {
  const res = await apiFetch<{ token: string; row: { id: number } }>(page, 'POST', '/api/tokens', {
    name: uniquePrefix('tok')
  })
  expect(res.status).toBe(201)
  return res.json
}

async function created<T>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  const res = await apiFetch<T>(page, method, path, body)
  expect(res.status, `${method} ${path}`).toBeLessThan(300)
  return res.json
}

async function seedUserA(page: Page, date: string) {
  const prefix = uniquePrefix('Iso ')
  const userId = (await created<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')).user.id
  const containers = await created<Container[]>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers[0]!.id

  const foodId = (
    await created<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
      name: `${prefix} Oats`,
      servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10, carbohydrate: 60, fat: 5 } }]
    })
  ).id
  const servingId = (await created<{ servings: { id: number }[] }>(page, 'GET', `/api/nutrition/foods/${foodId}`))
    .servings[0]!.id
  await created(page, 'PUT', `/api/nutrition/foods/${foodId}/favorite`)

  const entryId = (
    await created<{ ids: number[] }>(page, 'POST', `/api/nutrition/diary/${date}/entries`, [
      {
        entryType: 'quick_add',
        containerId,
        description: 'A quick add',
        quantity: 1,
        unitLabel: 'serving',
        nutrients: { energy: 500 }
      }
    ])
  ).ids[0]!
  await created(page, 'POST', `/api/nutrition/diary/${date}/entries`, [
    { entryType: 'food', containerId, foodId, quantity: 100, unitLabel: 'g' }
  ])
  await created(page, 'PUT', `/api/days/${date}/note`, { note: 'A note' })
  await created(page, 'PUT', `/api/body/steps/days/${date}`, { steps: 4321 })

  const types = await created<{ id: number; key: string | null }[]>(page, 'GET', '/api/body/types')
  const bodyweightId = types.find((t) => t.key === 'bodyweight')!.id
  const measurementId = (
    await created<{ id: number }>(page, 'POST', '/api/body/entries', { typeId: bodyweightId, value: 180 })
  ).id
  const typeId = (
    await created<{ id: number }>(page, 'POST', '/api/body/types', {
      name: `${prefix} Waist`,
      unit: 'cm',
      precision: 1,
      direction: 'lower'
    })
  ).id
  await created(page, 'POST', '/api/body/entries', { typeId, value: 90 })
  await created(page, 'PUT', `/api/body/types/${typeId}/goal`, { targetValue: 80 })

  const profileId = (
    await created<{ id: number }>(page, 'POST', '/api/nutrition/goal-profiles', {
      name: `${prefix} Cut`,
      inputMode: 'grams',
      isDefault: true,
      targets: [{ nutrient: 'energy', amount: 2000, direction: 'max' }]
    })
  ).id
  const recipeId = (
    await created<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
      name: `${prefix} Porridge`,
      servings: 2,
      servingName: 'Bowls',
      ingredients: [{ foodId, quantity: 200, unitLabel: 'g' }]
    })
  ).id
  const savedMealId = (
    await created<{ id: number }>(page, 'POST', '/api/nutrition/saved-meals', {
      name: `${prefix} Breakfast`,
      items: [{ foodId, quantity: 150, unitLabel: 'g' }]
    })
  ).id

  const reference = await created<{ categories: { id: number; key: string }[] }>(
    page,
    'GET',
    '/api/workouts/reference'
  )
  const exerciseId = (
    await created<{ id: number }>(page, 'POST', '/api/workouts/exercises', {
      name: `${prefix} Curl`,
      categoryId: reference.categories.find((c) => c.key === 'core')!.id,
      trackingType: 'weight_reps'
    })
  ).id
  await created(page, 'PUT', `/api/workouts/exercises/${exerciseId}/goal`, { metric: 'max_weight', targetValue: 120 })

  const routineId = (await created<Routine>(page, 'POST', '/api/workouts/routines', { name: `${prefix} Split` })).id
  const dayId = (await created<Routine>(page, 'POST', `/api/workouts/routines/${routineId}/days`, { name: 'Day A' }))
    .days[0]!.id
  const routineEntryId = (
    await created<Routine>(page, 'POST', `/api/workouts/routine-days/${dayId}/entries`, { exerciseId })
  ).days[0]!.entries[0]!.id

  const programId = (await created<Program>(page, 'POST', '/api/workouts/programs', { name: `${prefix} Block` })).id
  const phaseId = (
    await created<Program>(page, 'POST', `/api/workouts/programs/${programId}/phases`, {
      name: 'Base',
      weeks: 4,
      routineId
    })
  ).phases[0]!.id

  const sessionId = (await created<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: date })).id
  const workoutEntryId = (
    await created<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${sessionId}/entries`, { exerciseId })
  ).entries[0]!.id
  const setId = (
    await created<{ set: { id: number } }>(page, 'POST', `/api/workouts/entries/${workoutEntryId}/sets`, {
      weight: 50,
      reps: 8
    })
  ).set.id

  return {
    userId,
    containerId,
    foodId,
    servingId,
    entryId,
    bodyweightId,
    measurementId,
    typeId,
    profileId,
    recipeId,
    savedMealId,
    exerciseId,
    routineId,
    dayId,
    routineEntryId,
    programId,
    phaseId,
    sessionId,
    workoutEntryId,
    setId
  }
}

type Seed = Awaited<ReturnType<typeof seedUserA>>

function idCases(a: Seed, date: string): Case[] {
  const food = `/api/nutrition/foods/${a.foodId}`
  const exercise = `/api/workouts/exercises/${a.exerciseId}`
  const type = `/api/body/types/${a.typeId}`
  const routine = `/api/workouts/routines/${a.routineId}`
  const program = `/api/workouts/programs/${a.programId}`
  const session = `/api/workouts/sessions/${a.sessionId}`
  const serving = { kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 1 } }
  const ingredient = { foodId: a.foodId, quantity: 1, unitLabel: 'g' }
  const container = `/api/nutrition/meal-containers/${a.containerId}`
  return [
    { name: 'meal container PUT', method: 'PUT', path: container, body: { name: 'Taken' } },
    { name: 'meal container DELETE', method: 'DELETE', path: container },
    {
      name: 'diary entry PUT',
      method: 'PUT',
      path: `/api/nutrition/diary/entries/${a.entryId}`,
      body: { quantity: 2 }
    },
    { name: 'diary entry DELETE', method: 'DELETE', path: `/api/nutrition/diary/entries/${a.entryId}` },
    {
      name: 'diary entries bulk DELETE',
      method: 'POST',
      path: '/api/nutrition/diary/entries/delete',
      body: { ids: [a.entryId] }
    },
    { name: 'measurement PATCH', method: 'PATCH', path: `/api/body/entries/${a.measurementId}`, body: { value: 1 } },
    { name: 'measurement DELETE', method: 'DELETE', path: `/api/body/entries/${a.measurementId}` },
    { name: 'type entries GET', method: 'GET', path: `${type}/entries` },
    { name: 'type series GET', method: 'GET', path: `${type}/series` },
    { name: 'type PATCH', method: 'PATCH', path: type, body: { name: 'Taken' } },
    { name: 'type DELETE', method: 'DELETE', path: type },
    { name: 'type prefs PUT', method: 'PUT', path: `${type}/prefs`, body: { hidden: true } },
    { name: 'type goal PUT', method: 'PUT', path: `${type}/goal`, body: { targetValue: 1 } },
    { name: 'type goal DELETE', method: 'DELETE', path: `${type}/goal` },
    {
      name: 'goal profile PUT',
      method: 'PUT',
      path: `/api/nutrition/goal-profiles/${a.profileId}`,
      body: { name: 'Taken', inputMode: 'grams', isDefault: false, targets: [{ nutrient: 'energy', amount: 1 }] }
    },
    { name: 'goal profile DELETE', method: 'DELETE', path: `/api/nutrition/goal-profiles/${a.profileId}` },
    { name: 'recipe GET', method: 'GET', path: `/api/nutrition/recipes/${a.recipeId}` },
    {
      name: 'recipe PUT',
      method: 'PUT',
      path: `/api/nutrition/recipes/${a.recipeId}`,
      body: { name: 'Taken', servings: 1, servingName: 'x', ingredients: [ingredient] }
    },
    { name: 'recipe DELETE', method: 'DELETE', path: `/api/nutrition/recipes/${a.recipeId}` },
    { name: 'saved meal GET', method: 'GET', path: `/api/nutrition/saved-meals/${a.savedMealId}` },
    {
      name: 'saved meal PUT',
      method: 'PUT',
      path: `/api/nutrition/saved-meals/${a.savedMealId}`,
      body: { name: 'Taken', items: [ingredient] }
    },
    { name: 'saved meal DELETE', method: 'DELETE', path: `/api/nutrition/saved-meals/${a.savedMealId}` },
    { name: 'food GET', method: 'GET', path: food },
    { name: 'food PUT', method: 'PUT', path: food, body: { name: 'Taken' } },
    { name: 'food DELETE', method: 'DELETE', path: food },
    { name: 'food favorite PUT', method: 'PUT', path: `${food}/favorite` },
    { name: 'food fork POST', method: 'POST', path: `${food}/fork` },
    { name: 'food recent DELETE', method: 'DELETE', path: `${food}/recent` },
    { name: 'food servings POST', method: 'POST', path: `${food}/servings`, body: { ...serving, label: 'cup' } },
    { name: 'food serving PUT', method: 'PUT', path: `${food}/servings/${a.servingId}`, body: serving },
    { name: 'food serving DELETE', method: 'DELETE', path: `${food}/servings/${a.servingId}` },
    { name: 'exercise GET', method: 'GET', path: exercise },
    { name: 'exercise PUT', method: 'PUT', path: exercise, body: { name: 'Taken' } },
    { name: 'exercise DELETE', method: 'DELETE', path: exercise },
    { name: 'exercise prefs PUT', method: 'PUT', path: `${exercise}/prefs`, body: { notes: 'Taken' } },
    { name: 'exercise favorite PUT', method: 'PUT', path: `${exercise}/favorite` },
    { name: 'exercise favorite DELETE', method: 'DELETE', path: `${exercise}/favorite` },
    { name: 'exercise hidden PUT', method: 'PUT', path: `${exercise}/hidden` },
    { name: 'exercise hidden DELETE', method: 'DELETE', path: `${exercise}/hidden` },
    { name: 'exercise fork POST', method: 'POST', path: `${exercise}/fork` },
    { name: 'exercise history GET', method: 'GET', path: `${exercise}/history` },
    { name: 'exercise records GET', method: 'GET', path: `${exercise}/records` },
    { name: 'exercise series GET', method: 'GET', path: `${exercise}/series?metric=max_weight` },
    { name: 'exercise one-rep-max GET', method: 'GET', path: `${exercise}/one-rep-max?on=${date}` },
    {
      name: 'exercise goal PUT',
      method: 'PUT',
      path: `${exercise}/goal`,
      body: { metric: 'max_weight', targetValue: 100 }
    },
    { name: 'routine GET', method: 'GET', path: routine },
    { name: 'routine PATCH', method: 'PATCH', path: routine, body: { name: 'Taken' } },
    { name: 'routine DELETE', method: 'DELETE', path: routine },
    { name: 'routine duplicate POST', method: 'POST', path: `${routine}/duplicate` },
    { name: 'routine skip POST', method: 'POST', path: `${routine}/skip`, body: { date } },
    { name: 'routine days POST', method: 'POST', path: `${routine}/days`, body: { name: 'Taken' } },
    { name: 'routine day PATCH', method: 'PATCH', path: `/api/workouts/routine-days/${a.dayId}`, body: { name: 'T' } },
    { name: 'routine day DELETE', method: 'DELETE', path: `/api/workouts/routine-days/${a.dayId}` },
    {
      name: 'routine day entries POST',
      method: 'POST',
      path: `/api/workouts/routine-days/${a.dayId}/entries`,
      body: { exerciseId: a.exerciseId }
    },
    {
      name: 'routine day group POST',
      method: 'POST',
      path: `/api/workouts/routine-days/${a.dayId}/group`,
      body: { entryIds: [a.routineEntryId, a.routineEntryId + 1] }
    },
    {
      name: 'routine entry PATCH',
      method: 'PATCH',
      path: `/api/workouts/routine-entries/${a.routineEntryId}`,
      body: { targetSets: 9 }
    },
    { name: 'routine entry DELETE', method: 'DELETE', path: `/api/workouts/routine-entries/${a.routineEntryId}` },
    { name: 'program GET', method: 'GET', path: program },
    { name: 'program PATCH', method: 'PATCH', path: program, body: { name: 'Taken' } },
    { name: 'program DELETE', method: 'DELETE', path: program },
    { name: 'program duplicate POST', method: 'POST', path: `${program}/duplicate` },
    { name: 'program enroll POST', method: 'POST', path: `${program}/enroll`, body: { when: 'now', today: date } },
    { name: 'program export GET', method: 'GET', path: `${program}/export` },
    { name: 'program phases POST', method: 'POST', path: `${program}/phases`, body: { name: 'T', weeks: 1 } },
    { name: 'phase PATCH', method: 'PATCH', path: `/api/workouts/program-phases/${a.phaseId}`, body: { weeks: 9 } },
    { name: 'phase DELETE', method: 'DELETE', path: `/api/workouts/program-phases/${a.phaseId}` },
    { name: 'session GET', method: 'GET', path: session },
    { name: 'session PATCH', method: 'PATCH', path: session, body: { name: 'Taken' } },
    { name: 'session DELETE', method: 'DELETE', path: session },
    { name: 'session entries POST', method: 'POST', path: `${session}/entries`, body: { exerciseId: a.exerciseId } },
    {
      name: 'session group POST',
      method: 'POST',
      path: `${session}/group`,
      body: { entryIds: [a.workoutEntryId, a.workoutEntryId + 1] }
    },
    { name: 'entry PATCH', method: 'PATCH', path: `/api/workouts/entries/${a.workoutEntryId}`, body: { notes: 'T' } },
    { name: 'entry DELETE', method: 'DELETE', path: `/api/workouts/entries/${a.workoutEntryId}` },
    {
      name: 'entry sets POST',
      method: 'POST',
      path: `/api/workouts/entries/${a.workoutEntryId}/sets`,
      body: { weight: 1, reps: 1 }
    },
    { name: 'set PATCH', method: 'PATCH', path: `/api/workouts/sets/${a.setId}`, body: { reps: 99 } },
    { name: 'set DELETE', method: 'DELETE', path: `/api/workouts/sets/${a.setId}` }
  ]
}

// Ids nested in a body that point at A's rows; B's own parent (container, program) is used where the route needs one.
function referenceCases(a: Seed, date: string, b: { containerId: number; programId: number }): Case[] {
  const entries = `/api/nutrition/diary/${date}/entries`
  const ingredient = { foodId: a.foodId, quantity: 1, unitLabel: 'g' }
  return [
    {
      name: 'diary copy of A entry',
      method: 'POST',
      path: '/api/nutrition/diary/copy',
      body: { sourceEntryIds: [a.entryId], targetDate: date }
    },
    {
      name: 'diary goal with A profile',
      method: 'PUT',
      path: `/api/nutrition/diary/${date}/goal`,
      body: { profileId: a.profileId }
    },
    {
      name: 'diary meal time in A container',
      method: 'PUT',
      path: `/api/nutrition/diary/${date}/meal-time`,
      body: { containerId: a.containerId, time: '08:00' }
    },
    {
      name: 'diary quick add into A container',
      method: 'POST',
      path: entries,
      body: [{ entryType: 'quick_add', containerId: a.containerId, description: 'x', quantity: 1, unitLabel: 'x' }]
    },
    {
      name: 'diary entry of A food',
      method: 'POST',
      path: entries,
      body: [{ entryType: 'food', containerId: b.containerId, foodId: a.foodId, quantity: 100, unitLabel: 'g' }]
    },
    {
      name: 'diary entry of A recipe',
      method: 'POST',
      path: entries,
      body: [{ entryType: 'recipe', containerId: b.containerId, recipeId: a.recipeId, quantity: 1, unitLabel: 'x' }]
    },
    {
      name: 'diary entry of A saved meal',
      method: 'POST',
      path: entries,
      body: [{ entryType: 'food', containerId: b.containerId, savedMealId: a.savedMealId, quantity: 1, unitLabel: 'x' }]
    },
    {
      name: 'recipe from A container',
      method: 'POST',
      path: '/api/nutrition/recipes/from-diary',
      body: { date, containerId: a.containerId, name: 'x', servings: 1, servingName: 'x' }
    },
    {
      name: 'saved meal from A container',
      method: 'POST',
      path: '/api/nutrition/saved-meals/from-diary',
      body: { date, containerId: a.containerId, name: 'x' }
    },
    {
      name: 'recipe with A food',
      method: 'POST',
      path: '/api/nutrition/recipes',
      body: { name: 'x', servings: 1, servingName: 'x', ingredients: [ingredient] }
    },
    {
      name: 'saved meal with A food',
      method: 'POST',
      path: '/api/nutrition/saved-meals',
      body: { name: 'x', items: [ingredient] }
    },
    { name: 'measurement of A type', method: 'POST', path: '/api/body/entries', body: { typeId: a.typeId, value: 1 } },
    {
      name: 'session copied from A session',
      method: 'POST',
      path: '/api/workouts/sessions',
      body: { performedOn: date, copyFromId: a.sessionId }
    },
    {
      name: 'session started from A routine day',
      method: 'POST',
      path: '/api/workouts/sessions',
      body: { performedOn: date, routineDayId: a.dayId }
    },
    {
      name: 'variation group with A exercise',
      method: 'POST',
      path: '/api/workouts/variations',
      body: { name: uniquePrefix('Grab '), exerciseIds: [a.exerciseId] }
    },
    {
      name: 'B program phase on A routine',
      method: 'POST',
      path: `/api/workouts/programs/${b.programId}/phases`,
      body: { name: 'x', weeks: 1, routineId: a.routineId }
    }
  ]
}

// Kept apart from idCases: the user routes compare the id with the caller and answer 403, not 404.
function userCases(a: Seed): Case[] {
  return [
    { name: 'user GET', method: 'GET', path: `/api/users/${a.userId}` },
    { name: 'user PUT', method: 'PUT', path: `/api/users/${a.userId}`, body: { name: 'Hijack' } }
  ]
}

function dateCases(date: string): { reads: Case[]; writes: Case[] } {
  return {
    reads: [
      { name: 'day note GET', method: 'GET', path: `/api/days/${date}/note` },
      { name: 'step day GET', method: 'GET', path: `/api/body/steps/days/${date}` },
      { name: 'diary day GET', method: 'GET', path: `/api/nutrition/diary/${date}` }
    ],
    writes: [
      { name: 'day note PUT', method: 'PUT', path: `/api/days/${date}/note`, body: { note: 'B note' } },
      { name: 'step day PUT', method: 'PUT', path: `/api/body/steps/days/${date}`, body: { steps: 1 } },
      { name: 'step day DELETE', method: 'DELETE', path: `/api/body/steps/days/${date}` },
      {
        name: 'diary incomplete PUT',
        method: 'PUT',
        path: `/api/nutrition/diary/${date}/incomplete`,
        body: { incomplete: true }
      }
    ]
  }
}

// Self-scoped routes: B's call only ever touches B's own row, so a 2xx no-op is the correct answer.
function selfScopedCases(a: Seed): Case[] {
  return [
    { name: 'food favorite DELETE', method: 'DELETE', path: `/api/nutrition/foods/${a.foodId}/favorite` },
    {
      name: 'exercise goal DELETE',
      method: 'DELETE',
      path: `/api/workouts/exercises/${a.exerciseId}/goal?metric=max_weight`
    }
  ]
}

function snapshotPaths(a: Seed, date: string): string[] {
  return [
    `/api/nutrition/diary/${date}`,
    `/api/days/${date}/note`,
    `/api/body/steps/days/${date}`,
    `/api/body/types/${a.bodyweightId}/entries`,
    `/api/body/types/${a.typeId}/series`,
    '/api/body/types?includeHidden=1',
    '/api/body/goals',
    '/api/nutrition/goal-profiles',
    '/api/nutrition/meal-containers?includeArchived=1',
    `/api/nutrition/recipes/${a.recipeId}`,
    `/api/nutrition/saved-meals/${a.savedMealId}`,
    `/api/nutrition/foods/${a.foodId}`,
    '/api/nutrition/foods/recent?favorites=1',
    `/api/workouts/exercises/${a.exerciseId}`,
    '/api/workouts/variations',
    `/api/workouts/routines/${a.routineId}`,
    '/api/workouts/routines',
    `/api/workouts/programs/${a.programId}`,
    '/api/workouts/programs',
    `/api/workouts/enrollment?today=${date}`,
    `/api/workouts/sessions/${a.sessionId}`,
    `/api/users/${a.userId}`
  ]
}

async function snapshot(page: Page, paths: string[]) {
  const out: Record<string, unknown> = {}
  for (const path of paths) out[path] = await created(page, 'GET', path)
  const tokens = await created<{ id: number; name: string }[]>(page, 'GET', '/api/tokens')
  out.tokens = tokens.map(({ id, name }) => ({ id, name }))
  const exported = await created<Record<string, unknown>>(page, 'GET', '/api/export')
  delete exported.exportedAt
  out.export = exported
  return out
}

async function call<T = unknown>(ctx: APIRequestContext, base: string, token: string, c: Case) {
  return tokenFetch<T>(ctx, base, token, c.method, c.path, c.body)
}

test('a token never reads or changes another user\'s rows', async ({ page, goto, browser, playwright }) => {
  test.setTimeout(180_000)
  const date = todayDate()
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const base = new URL(page.url()).origin
  const a = await seedUserA(page, date)
  const aToken = await newToken(page)

  let before: Record<string, unknown> | undefined
  const other = await browser.newContext()
  const ctx = await playwright.request.newContext()
  try {
    const intruder = await other.newPage()
    await intruder.goto(page.url())
    await registerViaApi(intruder, makeUser())
    const bToken = (await newToken(intruder)).token

    const ids = idCases(a, date)
    const dates = dateCases(date)

    // Positive control: A's own token reaches every read, so B's refusals below can't pass vacuously.
    for (const c of [...ids, ...dates.reads].filter((c) => c.method === 'GET')) {
      const res = await call(ctx, base, aToken.token, c)
      expect(res.status, `A ${c.name}`).toBe(200)
    }
    expect((await call(ctx, base, aToken.token, dates.reads[0]!)).json).toEqual({ date, note: 'A note' })

    before = await snapshot(page, snapshotPaths(a, date))

    for (const c of ids) {
      const res = await call(ctx, base, bToken, c)
      expect(res.status, `B ${c.name}`).toBe(404)
    }

    for (const c of userCases(a)) {
      const res = await call(ctx, base, bToken, c)
      expect(res.status, `B ${c.name}`).toBe(403)
    }

    for (const c of dates.writes) {
      const res = await call(ctx, base, bToken, c)
      expect(res.status, `B ${c.name}`).toBe(200)
    }
    const bNote = await call(ctx, base, bToken, dates.reads[0]!)
    expect(bNote.json).toEqual({ date, note: 'B note' })
    expect((await call(ctx, base, bToken, dates.reads[1]!)).json).toEqual({ day: null })
    const bDiary = await call<{ entries: unknown[]; containers: { id: number }[] }>(ctx, base, bToken, dates.reads[2]!)
    expect(bDiary.json.entries).toEqual([])
    expect(bDiary.json.containers.some((c) => c.id === a.containerId)).toBe(false)

    const bProgram = await tokenFetch<Program>(ctx, base, bToken, 'POST', '/api/workouts/programs', { name: 'B block' })
    expect(bProgram.status).toBe(200)
    const b = { containerId: bDiary.json.containers[0]!.id, programId: bProgram.json.id }
    for (const c of referenceCases(a, date, b)) {
      const res = await call(ctx, base, bToken, c)
      expect(res.status, `B ${c.name}`).toBe(404)
    }

    for (const c of selfScopedCases(a)) {
      const res = await call(ctx, base, bToken, c)
      expect(res.status, `B ${c.name}`).toBe(200)
    }

    expect((await apiFetch(intruder, 'DELETE', `/api/tokens/${aToken.row.id}`)).status).toBe(404)
  } finally {
    await ctx.dispose()
    await other.close()
  }

  expect(await snapshot(page, snapshotPaths(a, date))).toEqual(before)
})
