import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Enrollment, Program } from '../../shared/types/program'
import type { Routine, RoutineSummary } from '../../shared/types/routine'
import { holdLocks } from './dbLock'

async function routine(page: Page, days: string[]) {
  const created = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: uniquePrefix('ER ') })).json
  let current = created
  for (const name of days)
    current = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${created.id}/days`, { name })).json
  return current
}

async function program(page: Page, phases: { name: string; weeks: number; routineId?: number }[]) {
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('EP ') })).json
  for (const phase of phases) await apiFetch(page, 'POST', `/api/workouts/programs/${created.id}/phases`, phase)
  return (await apiFetch<Program>(page, 'GET', `/api/workouts/programs/${created.id}`)).json
}

const read = (page: Page, today: string) => apiFetch<Enrollment>(page, 'GET', `/api/workouts/enrollment?today=${today}`)
const active = async (page: Page) =>
  (await apiFetch<RoutineSummary[]>(page, 'GET', '/api/workouts/routines')).json
    .filter((r) => r.active)
    .map((r) => r.id)
const pointer = async (page: Page, id: number) =>
  (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${id}`)).json.nextDayId

test('enroll now: rollover, rest week, completion', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1', 'A2'])
  const b = await routine(page, ['B1'])
  const p = await program(page, [
    { name: 'Build', weeks: 2, routineId: a.id },
    { name: 'Off', weeks: 1 },
    { name: 'Peak', weeks: 1, routineId: b.id }
  ])

  const enrolled = (
    await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, {
      when: 'now',
      today: '2026-01-07'
    })
  ).json
  expect(enrolled).toMatchObject({
    status: 'active',
    state: 'current',
    week: 1,
    totalWeeks: 4,
    phaseIndex: 0,
    anchorDate: '2026-01-05',
    notice: null
  })
  expect(enrolled.nextDay?.name).toBe('A1')
  expect(await active(page)).toEqual([a.id])

  await apiFetch(page, 'POST', `/api/workouts/routines/${a.id}/skip`)
  expect((await read(page, '2026-01-12')).json).toMatchObject({ week: 2, phaseIndex: 0, notice: null })
  expect(await pointer(page, a.id)).toBe(a.days[1]!.id)

  expect((await read(page, '2026-01-19')).json).toMatchObject({
    week: 3,
    phaseIndex: 1,
    notice: 'phase',
    phase: { routine: null }
  })
  expect(await active(page)).toEqual([])
  await apiFetch(page, 'POST', '/api/workouts/enrollment/dismiss-notice', { today: '2026-01-19' })
  expect((await read(page, '2026-01-20')).json.notice).toBeNull()

  await apiFetch(page, 'POST', `/api/workouts/routines/${b.id}/skip`)
  expect((await read(page, '2026-01-26')).json).toMatchObject({ week: 4, phaseIndex: 2, notice: 'phase' })
  expect(await active(page)).toEqual([b.id])
  expect(await pointer(page, b.id)).toBe(b.days[0]!.id)

  expect((await read(page, '2026-02-02')).json).toMatchObject({
    status: 'completed',
    state: 'finished',
    notice: 'complete'
  })
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

  const between = (
    await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, {
      when: 'next',
      today: '2026-01-07'
    })
  ).json
  expect(between).toMatchObject({ state: 'between', week: 1, anchorDate: '2026-01-12' })
  expect(await active(page)).toEqual([c.id])

  expect((await read(page, '2026-01-12')).json).toMatchObject({ state: 'current', week: 1, notice: 'phase' })
  expect(await active(page)).toEqual([a.id])
  await apiFetch(page, 'POST', `/api/workouts/routines/${a.id}/skip`)

  const paused = (await apiFetch<Enrollment>(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-01-14' }))
    .json
  expect(paused).toMatchObject({ status: 'paused', state: 'paused', week: 1, notice: null })
  expect((await apiFetch(page, 'PATCH', `/api/workouts/routines/${c.id}`, { active: true })).status).toBe(200)

  const resumed = (
    await apiFetch<Enrollment>(page, 'POST', '/api/workouts/enrollment/resume', { when: 'now', today: '2026-01-28' })
  ).json
  expect(resumed).toMatchObject({ status: 'active', state: 'current', week: 1, anchorDate: '2026-01-26', notice: null })
  expect(await active(page)).toEqual([a.id])
  expect(await pointer(page, a.id)).toBe(a.days[1]!.id)
  expect((await read(page, '2026-02-02')).json.week).toBe(2)

  await apiFetch(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-02-04' })
  const later = (
    await apiFetch<Enrollment>(page, 'POST', '/api/workouts/enrollment/resume', { when: 'next', today: '2026-02-04' })
  ).json
  expect(later).toMatchObject({ state: 'between', week: 2, anchorDate: '2026-02-09' })
})

test('conflicts, replace, end, and state errors', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const p = await program(page, [{ name: 'P', weeks: 2, routineId: a.id }])
  const q = await program(page, [{ name: 'Q', weeks: 2, routineId: a.id }])
  const empty = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Empty ') })).json

  expect(
    (await apiFetch(page, 'POST', `/api/workouts/programs/${empty.id}/enroll`, { when: 'now', today: '2026-01-05' }))
      .status
  ).toBe(400)
  expect((await apiFetch(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-01-05' })).status).toBe(409)

  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })
  const clash = await apiFetch<{ data: { code: string; program: { name: string } } }>(
    page,
    'POST',
    `/api/workouts/programs/${q.id}/enroll`,
    { when: 'now', today: '2026-01-05' }
  )
  expect(clash.status).toBe(409)
  expect(clash.json.data).toMatchObject({ code: 'enrollment_exists', program: { name: p.name } })

  const replaced = (
    await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${q.id}/enroll`, {
      when: 'now',
      today: '2026-01-05',
      replace: true
    })
  ).json
  expect(replaced.program.id).toBe(q.id)
  expect(
    (await apiFetch(page, 'POST', '/api/workouts/enrollment/resume', { when: 'now', today: '2026-01-05' })).status
  ).toBe(409)

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

  const next = await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${q.id}/enroll`, {
    when: 'now',
    today: '2026-01-19'
  })
  expect(next.status).toBe(200)
  const list = (await apiFetch<{ id: number; enrolled: boolean }[]>(page, 'GET', '/api/workouts/programs')).json
  expect(list.find((x) => x.id === p.id)?.enrolled).toBe(false)
  expect(list.find((x) => x.id === q.id)?.enrolled).toBe(true)
  const rows = (await apiFetch<{ programId: number; status: string }[]>(page, 'GET', '/api/workouts/_test/enrollments'))
    .json
  expect(rows).toEqual([
    { programId: p.id, status: 'completed' },
    { programId: q.id, status: 'active' }
  ])
  expect((await apiFetch(page, 'POST', '/api/workouts/enrollment/end', { today: '2026-01-19' })).status).toBe(204)
})

test('rollover into the same routine keeps the pointer', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1', 'A2'])
  const p = await program(page, [
    { name: 'Build', weeks: 1, routineId: a.id },
    { name: 'Deload', weeks: 1, routineId: a.id }
  ])
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
  const p = await program(page, [
    { name: 'One', weeks: 1, routineId: a.id },
    { name: 'Two', weeks: 2, routineId: a.id }
  ])
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

  const list = (await apiFetch<{ id: number; program: unknown }[]>(page, 'GET', '/api/workouts/sessions?limit=10')).json
  expect(list.find((s) => s.id === late)!.program).toMatchObject({
    phaseId: p.phases[1]!.id,
    phaseName: 'Two',
    phaseIndex: 1,
    week: 2
  })
  expect(list.find((s) => s.id === early)!.program).toMatchObject({ phaseId: p.phases[0]!.id, phaseIndex: 0, week: 1 })

  const byPhase = (
    await apiFetch<{ id: number; program: { phaseId: number } | null }[]>(
      page,
      'GET',
      `/api/workouts/sessions?limit=10&programId=${p.id}&phaseId=${p.phases[0]!.id}`
    )
  ).json
  expect(byPhase.map((s) => [s.id, s.program?.phaseId])).toEqual([[early, p.phases[0]!.id]])
  const byProgram = (await apiFetch<{ id: number }[]>(page, 'GET', `/api/workouts/sessions?limit=10&programId=${p.id}`))
    .json
  expect(byProgram.map((s) => s.id).sort()).toEqual([early, late].sort())

  await apiFetch(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-01-14' })
  const pausedStart = await start('2026-01-14')
  const after = (await apiFetch<{ id: number; program: unknown }[]>(page, 'GET', '/api/workouts/sessions?limit=10'))
    .json
  expect(after.find((s) => s.id === pausedStart)!.program).toBeNull()
})

test('routine guards: activation needs a pause, delete is blocked while a phase uses it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const c = await routine(page, ['C1'])
  const p = await program(page, [{ name: 'One', weeks: 4, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })

  const blocked = await apiFetch<{ data: { code: string; program: { id: number } } }>(
    page,
    'PATCH',
    `/api/workouts/routines/${c.id}`,
    { active: true, today: '2026-01-07' }
  )
  expect(blocked.status).toBe(409)
  expect(blocked.json.data).toMatchObject({ code: 'program_controls_routine', program: { id: p.id } })
  expect(await active(page)).toEqual([a.id])

  const ok = await apiFetch(page, 'PATCH', `/api/workouts/routines/${c.id}`, {
    active: true,
    pauseProgram: true,
    today: '2026-01-07'
  })
  expect(ok.status).toBe(200)
  expect((await read(page, '2026-01-07')).json).toMatchObject({ status: 'paused', week: 1 })
  expect(await active(page)).toEqual([c.id])

  const del = await apiFetch<{ data: { code: string; programs: { name: string }[] } }>(
    page,
    'DELETE',
    `/api/workouts/routines/${a.id}`
  )
  expect(del.status).toBe(409)
  expect(del.json.data).toMatchObject({ code: 'routine_in_program', programs: [{ name: p.name }] })
})

test('guards sync first: a finished program no longer blocks, a not-started one does not control', async ({
  page,
  goto
}) => {
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

test('the routine guard only fires when the active routine would change', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const c = await routine(page, ['C1'])
  const p = await program(page, [{ name: 'One', weeks: 4, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })

  expect(
    (await apiFetch(page, 'PATCH', `/api/workouts/routines/${c.id}`, { active: false, today: '2026-01-07' })).status
  ).toBe(200)
  expect(
    (await apiFetch(page, 'PATCH', `/api/workouts/routines/${a.id}`, { active: true, today: '2026-01-07' })).status
  ).toBe(200)
  expect((await read(page, '2026-01-07')).json.status).toBe('active')
  expect(
    (await apiFetch(page, 'PATCH', `/api/workouts/routines/${a.id}`, { active: false, today: '2026-01-07' })).status
  ).toBe(409)
  expect(await active(page)).toEqual([a.id])
})

test('on a rollover day, activating the routine the program rolls into is not refused', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const b = await routine(page, ['B1'])
  const p = await program(page, [
    { name: 'Build', weeks: 1, routineId: a.id },
    { name: 'Peak', weeks: 1, routineId: b.id }
  ])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })

  expect(
    (await apiFetch(page, 'PATCH', `/api/workouts/routines/${b.id}`, { active: true, today: '2026-01-12' })).status
  ).toBe(200)
  expect((await read(page, '2026-01-12')).json).toMatchObject({ status: 'active', phaseIndex: 1 })
  expect(await active(page)).toEqual([b.id])
})

// The page aborts the request after ms, so a hung one can't outlive the test like a Promise.race loser would.
const postWithin = (page: Page, ms: number, path: string, body: unknown) =>
  page.evaluate(
    async ({ ms, path, body }) => {
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(ms)
        })
        return { status: res.status, json: (await res.json()) as { id: number } }
      } catch {
        return 'timed out' as const
      }
    },
    { ms, path, body }
  )
const lockEnrollmentRow = (id: number) =>
  holdLocks('select id from app.user_program_enrollments where id = $1 for no key update', [id])

test('a session start does not wait on a sync holding the enrollment row', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const p = await program(page, [{ name: 'One', weeks: 4, routineId: a.id }])
  const enrolled = (
    await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, {
      when: 'now',
      today: '2026-01-05'
    })
  ).json

  // The lock syncEnrollment takes; the session insert's FK KEY SHARE on enrollment_id must not queue behind it.
  const lock = await lockEnrollmentRow(enrolled.id)
  let started: Awaited<ReturnType<typeof postWithin>>
  try {
    started = await postWithin(page, 5000, '/api/workouts/sessions', {
      routineDayId: a.days[0]!.id,
      performedOn: '2026-01-06'
    })
  } finally {
    await lock.release({ rollback: true })
  }
  expect(started).toMatchObject({ status: 200 })
  const id = (started as { json: { id: number } }).json.id
  const list = (await apiFetch<{ id: number; program: unknown }[]>(page, 'GET', '/api/workouts/sessions?limit=10')).json
  expect(list.find((s) => s.id === id)!.program).toMatchObject({ phaseId: p.phases[0]!.id })
})

test('a resume and an activation that pauses the program both land in order, without a deadlock', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const c = await routine(page, ['C1'])
  const p = await program(page, [{ name: 'Long', weeks: 8, routineId: a.id }])
  const enrolled = (
    await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, {
      when: 'now',
      today: '2026-01-05'
    })
  ).json
  await apiFetch(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-01-07' })

  const lock = await lockEnrollmentRow(enrolled.id)
  let resume: ReturnType<typeof apiFetch> | undefined
  let activation: ReturnType<typeof apiFetch> | undefined
  try {
    resume = apiFetch(page, 'POST', '/api/workouts/enrollment/resume', { when: 'now', today: '2026-01-14' })
    await lock.waitForBlocked(1)
    let settled = false
    activation = apiFetch(page, 'PATCH', `/api/workouts/routines/${c.id}`, {
      active: true,
      pauseProgram: true,
      today: '2026-01-14'
    }).finally(() => {
      settled = true
    })
    await expect.poll(async () => settled || (await lock.queued()) >= 2).toBe(true)
  } finally {
    await lock.release({ rollback: true })
  }
  expect([(await resume!).status, (await activation!).status]).toEqual([200, 200])
  expect(await active(page)).toEqual([c.id])
  expect((await read(page, '2026-01-14')).json).toMatchObject({ status: 'paused' })
})

test('a replacing enroll and an activation that pauses the program both land in order, without a deadlock', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const b = await routine(page, ['B1'])
  const c = await routine(page, ['C1'])
  const p = await program(page, [{ name: 'First', weeks: 8, routineId: a.id }])
  const q = await program(page, [{ name: 'Second', weeks: 8, routineId: b.id }])
  const enrolled = (
    await apiFetch<Enrollment>(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, {
      when: 'now',
      today: '2026-01-05'
    })
  ).json

  const lock = await lockEnrollmentRow(enrolled.id)
  let enroll: ReturnType<typeof apiFetch> | undefined
  let activation: ReturnType<typeof apiFetch> | undefined
  try {
    enroll = apiFetch(page, 'POST', `/api/workouts/programs/${q.id}/enroll`, {
      when: 'now',
      today: '2026-01-07',
      replace: true
    })
    await lock.waitForBlocked(1)
    let settled = false
    activation = apiFetch(page, 'PATCH', `/api/workouts/routines/${c.id}`, {
      active: true,
      pauseProgram: true,
      today: '2026-01-07'
    }).finally(() => {
      settled = true
    })
    await expect.poll(async () => settled || (await lock.queued()) >= 2).toBe(true)
  } finally {
    await lock.release({ rollback: true })
  }
  expect([(await enroll!).status, (await activation!).status]).toEqual([200, 200])
  expect(await active(page)).toEqual([c.id])
  expect((await read(page, '2026-01-07')).json).toMatchObject({ program: { id: q.id }, status: 'paused' })
})

test('pause accepts an empty body like dismiss and end; resume still needs when', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const p = await program(page, [{ name: 'One', weeks: 4, routineId: a.id }])
  // No today in the bodies below, so the server falls back to the UTC date; enroll on that same date.
  const today = new Date().toISOString().slice(0, 10)
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today })
  const paused = await apiFetch<Enrollment>(page, 'POST', '/api/workouts/enrollment/pause')
  expect(paused.status).toBe(200)
  expect(paused.json).toMatchObject({ status: 'paused', state: 'paused' })
  expect((await apiFetch(page, 'POST', '/api/workouts/enrollment/resume')).status).toBe(400)
  expect((await apiFetch(page, 'POST', '/api/workouts/enrollment/resume', { when: 'now' })).status).toBe(200)
  expect((await apiFetch(page, 'POST', '/api/workouts/enrollment/end')).status).toBe(204)
})

test('a phase filter without its program is ignored, as the client does', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const p = await program(page, [
    { name: 'One', weeks: 1, routineId: a.id },
    { name: 'Two', weeks: 2, routineId: a.id }
  ])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })
  const start = async (performedOn: string) => {
    const s = (await apiFetch<{ id: number }>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
    await apiFetch(page, 'PATCH', `/api/workouts/sessions/${s.id}`, { finish: true })
    return s.id
  }
  const early = await start('2026-01-06')
  const late = await start('2026-01-13')
  const loose = (
    await apiFetch<{ id: number; program: { phaseId: number } | null }[]>(
      page,
      'GET',
      `/api/workouts/sessions?limit=10&phaseId=${p.phases[0]!.id}`
    )
  ).json
  expect(loose.map((s) => [s.id, s.program?.phaseId]).sort()).toEqual(
    [
      [early, p.phases[0]!.id],
      [late, p.phases[1]!.id]
    ].sort()
  )
})

test('pausing before the start week, then resuming, starts at week 1', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1'])
  const p = await program(page, [{ name: 'Build', weeks: 2, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'next', today: '2026-01-07' })
  const paused = await apiFetch<Enrollment>(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-01-08' })
  expect(paused.status).toBe(200)
  expect(paused.json).toMatchObject({ status: 'paused', state: 'paused', week: 1 })
  expect(await active(page)).toEqual([])

  const resumed = (
    await apiFetch<Enrollment>(page, 'POST', '/api/workouts/enrollment/resume', { when: 'now', today: '2026-01-21' })
  ).json
  expect(resumed).toMatchObject({
    status: 'active',
    state: 'current',
    week: 1,
    phaseIndex: 0,
    anchorDate: '2026-01-19',
    notice: 'phase'
  })
  expect(await active(page)).toEqual([a.id])
})

test('changing the current phase\'s routine re-applies it on the next sync without a ' +
  'notice', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await routine(page, ['A1', 'A2'])
  const b = await routine(page, ['B1'])
  const p = await program(page, [{ name: 'Build', weeks: 4, routineId: a.id }])
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/enroll`, { when: 'now', today: '2026-01-05' })
  await apiFetch(page, 'POST', `/api/workouts/routines/${a.id}/skip`)

  await apiFetch(page, 'PATCH', `/api/workouts/program-phases/${p.phases[0]!.id}`, { routineId: b.id })
  expect((await read(page, '2026-01-06')).json).toMatchObject({
    phaseIndex: 0,
    notice: null,
    phase: { routine: { id: b.id } }
  })
  expect(await active(page)).toEqual([b.id])

  await apiFetch(page, 'PATCH', `/api/workouts/program-phases/${p.phases[0]!.id}`, { routineId: a.id })
  expect((await read(page, '2026-01-07')).json).toMatchObject({ notice: null, nextDay: { id: a.days[1]!.id } })
  expect(await active(page)).toEqual([a.id])
  expect(await pointer(page, a.id)).toBe(a.days[1]!.id)
})
