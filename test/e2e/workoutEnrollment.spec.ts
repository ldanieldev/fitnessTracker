import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Enrollment, Program } from '../../shared/types/program'
import type { Routine, RoutineSummary } from '../../shared/types/routine'

async function routine(page: Page, days: string[]) {
  const created = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: uniquePrefix('ER ') })).json
  let current = created
  for (const name of days) current = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${created.id}/days`, { name })).json
  return current
}

async function program(page: Page, phases: { name: string, weeks: number, routineId?: number }[]) {
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('EP ') })).json
  for (const phase of phases) await apiFetch(page, 'POST', `/api/workouts/programs/${created.id}/phases`, phase)
  return (await apiFetch<Program>(page, 'GET', `/api/workouts/programs/${created.id}`)).json
}

const read = (page: Page, today: string) => apiFetch<Enrollment>(page, 'GET', `/api/workouts/enrollment?today=${today}`)
const active = async (page: Page) =>
  (await apiFetch<RoutineSummary[]>(page, 'GET', '/api/workouts/routines')).json.filter((r) => r.active).map((r) => r.id)
const pointer = async (page: Page, id: number) => (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${id}`)).json.nextDayId

test('enroll now: rollover, rest week, completion', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1', 'A2'])
  const b = await routine(page, ['B1'])
  const p = await program(page, [{ name: 'Build', weeks: 2, routineId: a.id }, { name: 'Off', weeks: 1 }, { name: 'Peak', weeks: 1, routineId: b.id }])

  const enrolled = (await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-07' })).json
  expect(enrolled).toMatchObject({ status: 'active', state: 'current', week: 1, totalWeeks: 4, phaseIndex: 0, anchorDate: '2026-01-05', notice: null })
  expect(enrolled.nextDay?.name).toBe('A1')
  expect(await active(page)).toEqual([a.id])

  await apiFetch(page, 'POST', `/api/workouts/routines/${a.id}/skip`)
  expect((await read(page, '2026-01-12')).json).toMatchObject({ week: 2, phaseIndex: 0, notice: null })
  expect(await pointer(page, a.id)).toBe(a.days[1]!.id)

  expect((await read(page, '2026-01-19')).json).toMatchObject({ week: 3, phaseIndex: 1, notice: 'phase', phase: { routine: null } })
  expect(await active(page)).toEqual([])
  await apiFetch(page, 'POST', '/api/workouts/enrollment/dismiss-notice', { today: '2026-01-19' })
  expect((await read(page, '2026-01-20')).json.notice).toBeNull()

  await apiFetch(page, 'POST', `/api/workouts/routines/${b.id}/skip`)
  expect((await read(page, '2026-01-26')).json).toMatchObject({ week: 4, phaseIndex: 2, notice: 'phase' })
  expect(await active(page)).toEqual([b.id])
  expect(await pointer(page, b.id)).toBe(b.days[0]!.id)

  expect((await read(page, '2026-02-02')).json).toMatchObject({ status: 'completed', state: 'finished', notice: 'complete' })
  expect(await active(page)).toEqual([])
  await apiFetch(page, 'POST', '/api/workouts/enrollment/dismiss-notice', { today: '2026-02-02' })
  expect((await read(page, '2026-02-03')).status).toBe(204)
})

test('enroll next is between weeks; resume restores the phase routine', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1', 'A2'])
  const c = await routine(page, ['C1'])
  await apiFetch(page, 'PATCH', `/api/workouts/routines/${c.id}`, { active: true })
  const p = await program(page, [{ name: 'Build', weeks: 4, routineId: a.id }])

  const between = (await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'next', today: '2026-01-07' })).json
  expect(between).toMatchObject({ state: 'between', week: 1, anchorDate: '2026-01-12' })
  expect(await active(page)).toEqual([c.id])

  expect((await read(page, '2026-01-12')).json).toMatchObject({ state: 'current', week: 1, notice: 'phase' })
  expect(await active(page)).toEqual([a.id])
  await apiFetch(page, 'POST', `/api/workouts/routines/${a.id}/skip`)

  const paused = (await apiFetch<Enrollment>(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-01-14' })).json
  expect(paused).toMatchObject({ status: 'paused', state: 'paused', week: 1, notice: null })
  expect((await apiFetch(page, 'PATCH', `/api/workouts/routines/${c.id}`, { active: true })).status).toBe(200)

  const resumed = (await apiFetch<Enrollment>(page, 'POST', '/api/workouts/enrollment/resume', { when: 'now', today: '2026-01-28' })).json
  expect(resumed).toMatchObject({ status: 'active', state: 'current', week: 1, anchorDate: '2026-01-26', notice: null })
  expect(await active(page)).toEqual([a.id])
  expect(await pointer(page, a.id)).toBe(a.days[1]!.id)
  expect((await read(page, '2026-02-02')).json.week).toBe(2)

  await apiFetch(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-02-04' })
  const later = (await apiFetch<Enrollment>(page, 'POST', '/api/workouts/enrollment/resume', { when: 'next', today: '2026-02-04' })).json
  expect(later).toMatchObject({ state: 'between', week: 2, anchorDate: '2026-02-09' })
})

test('conflicts, replace, end, and state errors', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const p = await program(page, [{ name: 'P', weeks: 2, routineId: a.id }])
  const q = await program(page, [{ name: 'Q', weeks: 2, routineId: a.id }])
  const empty = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Empty ') })).json

  expect((await apiFetch(page, 'POST', `/api/workouts/programs/${empty.id}/enroll`, { when: 'now', today: '2026-01-05' })).status).toBe(400)
  expect((await apiFetch(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-01-05' })).status).toBe(409)

  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })
  const clash = await apiFetch<{ data: { code: string, program: { name: string } } }>(page, 'POST', `/api/workouts/programs/${q.id}/enroll`, { when: 'now', today: '2026-01-05' })
  expect(clash.status).toBe(409)
  expect(clash.json.data).toMatchObject({ code: 'enrollment_exists', program: { name: p.name } })

  const replaced = (await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${q.id}/enroll`, { when: 'now', today: '2026-01-05', replace: true })).json
  expect(replaced.program.id).toBe(q.id)
  expect((await apiFetch(page, 'POST', '/api/workouts/enrollment/resume', { when: 'now', today: '2026-01-05' })).status).toBe(409)

  expect((await apiFetch(page, 'POST', '/api/workouts/enrollment/end', { today: '2026-01-05' })).status).toBe(204)
  expect((await read(page, '2026-01-06')).status).toBe(204)
  expect(await active(page)).toEqual([a.id])
})

test('editing phases short completes', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const p = await program(page, [{ name: 'Long', weeks: 4, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })
  expect((await read(page, '2026-01-26')).json.week).toBe(4)
  await apiFetch(page, 'PATCH', `/api/workouts/program-phases/${p.phases[0]!.id}`, { weeks: 2 })
  expect((await read(page, '2026-01-27')).json).toMatchObject({ status: 'completed', notice: 'complete' })
})

test('enrolling syncs a stale enrollment first, so no false conflict', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const p = await program(page, [{ name: 'Short', weeks: 1, routineId: a.id }])
  const q = await program(page, [{ name: 'Next', weeks: 1, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })

  const next = await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${q.id}/enroll`, { when: 'now', today: '2026-01-19' })
  expect(next.status).toBe(200)
  const list = (await apiFetch<{ id: number, enrolled: boolean }[]>(page, 'GET', '/api/workouts/programs')).json
  expect(list.find((x) => x.id === p.id)?.enrolled).toBe(false)
  expect(list.find((x) => x.id === q.id)?.enrolled).toBe(true)
  expect((await apiFetch(page, 'POST', '/api/workouts/enrollment/end', { today: '2026-01-19' })).status).toBe(204)
})

test('rollover into the same routine keeps the pointer', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1', 'A2'])
  const p = await program(page, [{ name: 'Build', weeks: 1, routineId: a.id }, { name: 'Deload', weeks: 1, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })
  await apiFetch(page, 'POST', `/api/workouts/routines/${a.id}/skip`)
  const before = await pointer(page, a.id)
  expect((await read(page, '2026-01-12')).json).toMatchObject({ notice: 'phase', phaseIndex: 1 })
  expect(await pointer(page, a.id)).toBe(before)
})

test('session tags, retroactive start tags its own week, history filter', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const p = await program(page, [{ name: 'One', weeks: 1, routineId: a.id }, { name: 'Two', weeks: 2, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })
  const start = async (performedOn: string) => {
    const s = (await apiFetch<{ id: number }>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
    await apiFetch(page, 'PATCH', `/api/workouts/sessions/${s.id}`, { finish: true })
    return s.id
  }
  expect((await read(page, '2026-01-13')).json.phaseIndex).toBe(1)
  const pointerBefore = await pointer(page, a.id)
  const late = await start('2026-01-13')
  const early = await start('2026-01-06')
  expect(await pointer(page, a.id)).toBe(pointerBefore)
  expect((await read(page, '2026-01-13')).json).toMatchObject({ phaseIndex: 1, notice: 'phase' })

  const list = (await apiFetch<{ id: number, program: unknown }[]>(page, 'GET', '/api/workouts/sessions?limit=10')).json
  expect(list.find((s) => s.id === late)!.program).toMatchObject({ phaseId: p.phases[1]!.id, phaseName: 'Two', phaseIndex: 1, week: 2 })
  expect(list.find((s) => s.id === early)!.program).toMatchObject({ phaseId: p.phases[0]!.id, phaseIndex: 0, week: 1 })

  const byPhase = (await apiFetch<{ id: number }[]>(page, 'GET', `/api/workouts/sessions?limit=10&programId=${p.id}&phaseId=${p.phases[0]!.id}`)).json
  expect(byPhase.map((s) => s.id)).toEqual([early])
  const byProgram = (await apiFetch<{ id: number }[]>(page, 'GET', `/api/workouts/sessions?limit=10&programId=${p.id}`)).json
  expect(byProgram.map((s) => s.id).sort()).toEqual([early, late].sort())

  await apiFetch(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-01-14' })
  const pausedStart = await start('2026-01-14')
  const after = (await apiFetch<{ id: number, program: unknown }[]>(page, 'GET', '/api/workouts/sessions?limit=10')).json
  expect(after.find((s) => s.id === pausedStart)!.program).toBeNull()
})

test('routine guards: activation needs a pause, delete is blocked while a phase uses it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const c = await routine(page, ['C1'])
  const p = await program(page, [{ name: 'One', weeks: 4, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })

  const blocked = await apiFetch<{ data: { code: string, program: { id: number } } }>(page, 'PATCH', `/api/workouts/routines/${c.id}`, { active: true, today: '2026-01-07' })
  expect(blocked.status).toBe(409)
  expect(blocked.json.data).toMatchObject({ code: 'program_controls_routine', program: { id: p.id } })
  expect(await active(page)).toEqual([a.id])

  const ok = await apiFetch(page, 'PATCH', `/api/workouts/routines/${c.id}`, { active: true, pauseProgram: true, today: '2026-01-07' })
  expect(ok.status).toBe(200)
  expect((await read(page, '2026-01-07')).json).toMatchObject({ status: 'paused', week: 1 })
  expect(await active(page)).toEqual([c.id])

  const del = await apiFetch<{ data: { code: string, programs: { name: string }[] } }>(page, 'DELETE', `/api/workouts/routines/${a.id}`)
  expect(del.status).toBe(409)
  expect(del.json.data).toMatchObject({ code: 'routine_in_program', programs: [{ name: p.name }] })
})

test('guards sync first: a finished program no longer blocks, a not-started one does not control', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const c = await routine(page, ['C1'])
  const p = await program(page, [{ name: 'One', weeks: 1, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })
  const past = await apiFetch(page, 'PATCH', `/api/workouts/routines/${c.id}`, { active: true, today: '2026-02-20' })
  expect(past.status).toBe(200)
  expect((await read(page, '2026-02-20')).json).toMatchObject({ status: 'completed' })
  expect(await active(page)).toEqual([c.id])

  const q = await program(page, [{ name: 'Later', weeks: 2, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${q.id}/enroll`, { when: 'next', today: '2026-03-04' })
  const before = await apiFetch(page, 'PATCH', `/api/workouts/routines/${a.id}`, { active: true, today: '2026-03-05' })
  expect(before.status).toBe(200)
  expect((await read(page, '2026-03-05')).json).toMatchObject({ status: 'active', state: 'between' })
  expect(await active(page)).toEqual([a.id])
})

test('ending a just-finished program is not an error', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const p = await program(page, [{ name: 'One', weeks: 1, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })
  const ended = await apiFetch(page, 'POST', '/api/workouts/enrollment/end', { today: '2026-02-20' })
  expect(ended.status).toBe(204)
  expect((await read(page, '2026-02-20')).json).toMatchObject({ status: 'completed' })
})
