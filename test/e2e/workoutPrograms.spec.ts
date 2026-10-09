import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { holdLocks } from './dbLock'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Program, ProgramSummary } from '../../shared/types/program'
import type { Routine, RoutineSummary } from '../../shared/types/routine'

async function routineWithDay(page: Page, name = uniquePrefix('Prog Routine ')) {
  const routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name })).json
  return (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/days`, { name: 'Day A' })).json
}

test('program CRUD, phases, reorder, totals, duplicate', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const upper = await routineWithDay(page)
  const name = uniquePrefix('BLS ')
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name })).json
  expect(created).toMatchObject({ name, description: null, totalWeeks: 0, phases: [] })

  await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'Phase 1', weeks: 8, routineId: upper.id })
  await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'Deload', weeks: 1, routineId: upper.id, deload: true })
  let program = (await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'Off', weeks: 1 })).json
  expect(program.totalWeeks).toBe(10)
  expect(program.phases.map((p) => [p.name, p.weeks, p.deload, p.routine?.id ?? null])).toEqual([
    ['Phase 1', 8, false, upper.id], ['Deload', 1, true, upper.id], ['Off', 1, false, null]
  ])
  expect(program.phases[0]!.routine).toMatchObject({ name: upper.name, dayCount: 1 })

  const off = program.phases[2]!
  program = (await apiFetch<Program>(page, 'PATCH', `/api/workouts/program-phases/${off.id}`, { sortOrder: 0, weeks: 2 })).json
  expect(program.phases.map((p) => p.name)).toEqual(['Off', 'Phase 1', 'Deload'])
  expect(program.totalWeeks).toBe(11)

  expect((await apiFetch(page, 'PATCH', `/api/workouts/program-phases/${off.id}`, { weeks: 0 })).status).toBe(400)

  program = (await apiFetch<Program>(page, 'DELETE', `/api/workouts/program-phases/${off.id}`)).json
  expect(program.phases.map((p) => p.sortOrder)).toEqual([0, 1])

  program = (await apiFetch<Program>(page, 'PATCH', `/api/workouts/programs/${created.id}`, { description: 'Bigger Leaner Stronger' })).json
  expect(program.description).toBe('Bigger Leaner Stronger')

  const copy = (await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/duplicate`)).json
  expect(copy.name).toBe(`${name} (copy)`)
  expect(copy.phases.map((p) => p.routine?.id)).toEqual([upper.id, upper.id])

  const list = (await apiFetch<ProgramSummary[]>(page, 'GET', '/api/workouts/programs')).json
  expect(list.find((p) => p.id === created.id)).toMatchObject({ phaseCount: 2, totalWeeks: 9, enrolled: false })

  expect((await apiFetch(page, 'DELETE', `/api/workouts/programs/${copy.id}`)).status).toBe(200)
  expect((await apiFetch(page, 'GET', `/api/workouts/programs/${copy.id}`)).status).toBe(404)
})

test('phases reject another user\'s routine; another user cannot see a program', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const theirs = await routineWithDay(page)
  const theirProgram = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('P ') })).json
  await registerViaApi(page, makeUser())
  const mine = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('P ') })).json
  expect((await apiFetch(page, 'POST', `/api/workouts/programs/${mine.id}/phases`, { name: 'x', weeks: 1, routineId: theirs.id })).status).toBe(404)
  expect((await apiFetch(page, 'GET', `/api/workouts/programs/${theirProgram.id}`)).status).toBe(404)
  expect((await apiFetch(page, 'PATCH', `/api/workouts/programs/${theirProgram.id}`, { name: 'x' })).status).toBe(404)
  expect((await apiFetch(page, 'POST', `/api/workouts/programs/${theirProgram.id}/phases`, { name: 'x', weeks: 1 })).status).toBe(404)
  expect((await apiFetch(page, 'DELETE', `/api/workouts/programs/${theirProgram.id}`)).status).toBe(404)
})

test('concurrent phase adds get distinct sort orders', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Race ') })).json
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) =>
    apiFetch(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: `P${i}`, weeks: 1 })))
  expect(results.map((r) => r.status)).toEqual(Array(6).fill(200))
  const after = (await apiFetch<Program>(page, 'GET', `/api/workouts/programs/${created.id}`)).json
  expect(after.phases.map((p) => p.sortOrder)).toEqual([0, 1, 2, 3, 4, 5])
})

test('a phase pointed at a routine deleted while it waits answers 404, not an FK error', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: uniquePrefix('Doomed ') })).json
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('FK ') })).json
  const phase = (await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'Off', weeks: 1 })).json.phases[0]!

  const lock = await holdLocks('delete from app.routines where id = $1', [routine.id])
  const added = apiFetch(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'New', weeks: 1, routineId: routine.id })
  const patched = apiFetch(page, 'PATCH', `/api/workouts/program-phases/${phase.id}`, { routineId: routine.id })
  try {
    await lock.waitForBlocked(2)
  } finally {
    await lock.release()
  }

  expect([(await added).status, (await patched).status]).toEqual([404, 404])
  const after = (await apiFetch<Program>(page, 'GET', `/api/workouts/programs/${created.id}`)).json
  expect(after.phases.map((p) => [p.name, p.routine])).toEqual([['Off', null]])
})

test('duplicating a program whose routine is deleted mid-copy keeps the phase without the routine', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: uniquePrefix('Doomed ') })).json
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Dup FK ') })).json
  await apiFetch(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'Main', weeks: 2, routineId: routine.id })

  const lock = await holdLocks('delete from app.routines where id = $1', [routine.id])
  const duplicated = apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/duplicate`)
  try {
    await lock.waitForBlocked(1)
  } finally {
    await lock.release()
  }

  const copy = await duplicated
  expect(copy.status).toBe(200)
  expect(copy.json.phases.map((p) => [p.name, p.weeks, p.routine])).toEqual([['Main', 2, null]])
})

test('a phase deleted while another delete of it waits answers 404 to the second', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Twice ') })).json
  await apiFetch(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'A', weeks: 1 })
  const phase = (await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'B', weeks: 1 })).json.phases[1]!

  const lock = await holdLocks('select id from app.programs where id = $1 for update', [created.id])
  const deletes = [0, 1].map(() => apiFetch(page, 'DELETE', `/api/workouts/program-phases/${phase.id}`))
  try {
    await lock.waitForBlocked(2)
  } finally {
    await lock.release()
  }

  expect((await Promise.all(deletes)).map((r) => r.status).sort()).toEqual([200, 404])
})

test('deleting a running program ends it, untags its workouts and keeps the routine', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routineWithDay(page)
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Del ') })).json
  const p = (await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'One', weeks: 4, routineId: a.id })).json
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })
  const s = (await apiFetch<{ id: number }>(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-01-06' })).json
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${s.id}`, { finish: true })
  const tagged = (await apiFetch<{ id: number, program: unknown }[]>(page, 'GET', '/api/workouts/sessions?limit=10')).json
  expect(tagged.find((x) => x.id === s.id)!.program).toMatchObject({ phaseId: p.phases[0]!.id })

  expect((await apiFetch(page, 'DELETE', `/api/workouts/programs/${p.id}`)).status).toBe(200)
  expect((await apiFetch(page, 'GET', '/api/workouts/enrollment?today=2026-01-07')).status).toBe(204)
  expect((await apiFetch(page, 'PATCH', `/api/workouts/program-phases/${p.phases[0]!.id}`, { weeks: 2 })).status).toBe(404)
  const untagged = (await apiFetch<{ id: number, program: unknown }[]>(page, 'GET', '/api/workouts/sessions?limit=10')).json
  expect(untagged.find((x) => x.id === s.id)!.program).toBeNull()
  expect((await apiFetch(page, 'GET', `/api/workouts/routines/${a.id}`)).status).toBe(200)
  const active = (await apiFetch<RoutineSummary[]>(page, 'GET', '/api/workouts/routines')).json.filter((r) => r.active).map((r) => r.id)
  expect(active).toEqual([a.id])
})

test('phase routine can be cleared to a rest week but not pointed at another user\'s or a missing routine', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const theirs = await routineWithDay(page)
  const theirProgram = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Theirs ') })).json
  const theirPhase = (await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${theirProgram.id}/phases`, { name: 'T', weeks: 2 })).json.phases[0]!
  await registerViaApi(page, makeUser())
  const mine = await routineWithDay(page)
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Mine ') })).json
  const p = (await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'Main', weeks: 2, routineId: mine.id })).json
  const phaseId = p.phases[0]!.id

  const rest = await apiFetch<Program>(page, 'PATCH', `/api/workouts/program-phases/${phaseId}`, { routineId: null })
  expect(rest.status).toBe(200)
  expect(rest.json.phases[0]!.routine).toBeNull()
  const foreign = await apiFetch<{ statusMessage: string }>(page, 'PATCH', `/api/workouts/program-phases/${phaseId}`, { routineId: theirs.id })
  const missing = await apiFetch<{ statusMessage: string }>(page, 'PATCH', `/api/workouts/program-phases/${phaseId}`, { routineId: 2147483000 })
  expect([foreign.status, foreign.json.statusMessage]).toEqual([404, 'Routine not found'])
  expect([missing.status, missing.json.statusMessage]).toEqual([404, 'Routine not found'])
  expect((await apiFetch<Program>(page, 'GET', `/api/workouts/programs/${p.id}`)).json.phases[0]!.routine).toBeNull()

  expect((await apiFetch(page, 'PATCH', `/api/workouts/program-phases/${theirPhase.id}`, { weeks: 3 })).status).toBe(404)
  expect((await apiFetch(page, 'DELETE', `/api/workouts/program-phases/${theirPhase.id}`)).status).toBe(404)
  expect((await apiFetch(page, 'POST', `/api/workouts/programs/${theirProgram.id}/enroll`, { when: 'now', today: '2026-01-05' })).status).toBe(404)
  expect((await apiFetch(page, 'GET', '/api/workouts/enrollment?today=2026-01-05')).status).toBe(204)
})

test('non-numeric and non-positive program and phase ids are 404', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const calls: [string, string, unknown?][] = [
    ['GET', '/api/workouts/programs/abc'],
    ['PATCH', '/api/workouts/programs/abc', { name: 'x' }],
    ['DELETE', '/api/workouts/programs/abc'],
    ['POST', '/api/workouts/programs/abc/phases', { name: 'x', weeks: 1 }],
    ['POST', '/api/workouts/programs/abc/duplicate'],
    ['GET', '/api/workouts/programs/abc/export'],
    ['POST', '/api/workouts/programs/abc/enroll', { when: 'now' }],
    ['PATCH', '/api/workouts/program-phases/abc', { weeks: 2 }],
    ['DELETE', '/api/workouts/program-phases/abc'],
    ['GET', '/api/workouts/programs/1.5'],
    ['GET', '/api/workouts/programs/-1']
  ]
  for (const [method, path, body] of calls) {
    expect((await apiFetch(page, method, path, body)).status, `${method} ${path}`).toBe(404)
  }
})

test('a program delete queues behind a sync or enroll holding the routine and enrollment locks, without a deadlock', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routineWithDay(page)
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Lock ') })).json
  await apiFetch(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'One', weeks: 1, routineId: a.id })
  const p = (await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'Two', weeks: 1, routineId: a.id })).json
  const enrolled = (await apiFetch<{ id: number }>(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })).json

  // The global order a sync or enroll takes: the user's routines (here just one), then the live enrollment; then what each goes on to touch.
  const lock = await holdLocks(
    'select 1 from app.routines r, app.user_program_enrollments e where r.id = $1 and e.id = $2 for no key update',
    [a.id, enrolled.id]
  )
  let deleted: ReturnType<typeof apiFetch> | undefined
  try {
    deleted = apiFetch(page, 'DELETE', `/api/workouts/programs/${p.id}`)
    await lock.waitForBlocked(1)
    await lock.client.query('select id from app.programs where id = $1 for key share', [p.id])
    await lock.client.query('update app.user_program_enrollments set current_phase_id = $1 where id = $2', [p.phases[1]!.id, enrolled.id])
  } finally {
    await lock.release({ rollback: true })
  }
  expect((await deleted!).status).toBe(200)
  expect((await apiFetch(page, 'GET', `/api/workouts/programs/${p.id}`)).status).toBe(404)
  expect((await apiFetch(page, 'GET', '/api/workouts/enrollment?today=2026-01-07')).status).toBe(204)
})

test('an enroll queued behind a program delete that wins answers 404, not "add a phase"', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routineWithDay(page)
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Gone ') })).json
  await apiFetch(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'One', weeks: 1, routineId: a.id })

  const lock = await holdLocks('select 1 from app.routines where id = $1 for no key update', [a.id])
  let enrolled: ReturnType<typeof apiFetch> | undefined
  try {
    enrolled = apiFetch(page, 'POST', `/api/workouts/programs/${created.id}/enroll`, { when: 'now', today: '2026-01-05' })
    await lock.waitForBlocked(1)
    await lock.client.query('delete from app.programs where id = $1', [created.id])
  } finally {
    await lock.release()
  }
  const res = (await enrolled!) as { status: number, json: { statusMessage?: string } }
  expect([res.status, res.json.statusMessage]).toEqual([404, 'Program not found'])
})
