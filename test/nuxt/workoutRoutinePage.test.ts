import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createError, readBody, type H3Event } from 'h3'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import RoutinePage from '../../app/pages/workouts/routines/[id].vue'
import WorkoutRoutineDayCard from '../../app/components/workout/WorkoutRoutineDayCard.vue'

const failTitles = vi.hoisted(() => [] as string[])
mockNuxtImport('useFailToast', () => () => (title: string) => {
  failTitles.push(title)
})

mockNuxtImport('useUserSession', () => () => ({
  loggedIn: { value: true },
  user: { value: { id: 1, weekStart: 1 } },
  fetch: vi.fn(),
  clear: vi.fn()
}))

const entry = {
  id: 5,
  exerciseId: 1,
  exerciseName: 'Plank',
  trackingType: 'time',
  deleted: false,
  sortOrder: 0,
  target: null,
  supersetGroup: null,
  optional: false,
  restSeconds: null,
  notes: null
}
const routine = {
  id: 3,
  name: 'PPL',
  notes: null,
  active: false,
  nextDayId: 2,
  days: [{ id: 2, name: 'Push', description: null, floating: false, sortOrder: 0, entries: [entry] }]
}
const gate = { release: () => {} }
const waitForGate = () =>
  new Promise<void>((resolve) => {
    gate.release = resolve
  })
const gatedRename = async () => {
  await waitForGate()
  return { ...routine, name: 'Renamed' }
}
const patch = { handler: gatedRename as (event: H3Event) => Promise<unknown> }

registerEndpoint('/api/workouts/routines/3', {
  method: 'GET',
  handler: () => routine
})
registerEndpoint('/api/workouts/routines/3', {
  method: 'PATCH',
  handler: (event) => patch.handler(event)
})
registerEndpoint('/api/workouts/routines', () => [])
registerEndpoint('/api/workouts/exercises', { method: 'GET', handler: () => [] })
registerEndpoint('/api/workouts/reference', () => ({
  categories: [{ id: 1, key: 'chest', name: 'Chest', color: 'red' }],
  muscles: [],
  equipment: []
}))

const q = (sel: string) => document.querySelector<HTMLElement>(`[data-test="${sel}"]`)
const control = (sel: string) => {
  const el = q(sel)!
  return el.matches('input, textarea, button') ? el : el.querySelector<HTMLElement>('input, textarea, button')!
}
const disabled = (sel: string) => control(sel).hasAttribute('disabled')

async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

async function startRename() {
  const name = control('routine-name') as HTMLInputElement
  name.value = `Renamed ${Math.random()}`
  name.dispatchEvent(new Event('input'))
  name.dispatchEvent(new Event('change'))
  await flushPromises()
}

async function finishWrite() {
  gate.release()
  await settle()
}

afterEach(() => {
  patch.handler = gatedRename
  failTitles.length = 0
  clearNuxtData()
  document.body.innerHTML = ''
})

describe('workouts/routines/[id] page', () => {
  it('locks every editing control while a write is in flight, so nothing typed or tapped is dropped', async () => {
    const wrapper = await mountSuspended(RoutinePage, { route: '/workouts/routines/3', attachTo: document.body })
    await flushPromises()
    try {
      await wrapper.find('[data-test="routine-entry-open-5"]').trigger('click')
      await flushPromises()
      expect(disabled('routine-entry-save')).toBe(false)

      const name = control('routine-name') as HTMLInputElement
      name.value = 'Renamed'
      name.dispatchEvent(new Event('input'))
      name.dispatchEvent(new Event('change'))
      await flushPromises()

      for (const sel of [
        'routine-name',
        'routine-notes',
        'routine-day-add',
        'routine-day-menu-2',
        'routine-entry-open-5',
        'routine-entry-menu-5',
        'routine-day-add-exercise-2',
        'routine-skip',
        'routine-entry-save',
        'routine-entry-remove'
      ]) {
        expect(disabled(sel), sel).toBe(true)
      }

      gate.release()
      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 20))
      await flushPromises()
      expect(disabled('routine-name')).toBe(false)
      expect(disabled('routine-entry-save')).toBe(false)
    } finally {
      gate.release()
      wrapper.unmount()
    }
  })

  it('locks the delete-day confirm while a write is in flight', async () => {
    const wrapper = await mountSuspended(RoutinePage, { route: '/workouts/routines/3', attachTo: document.body })
    await flushPromises()
    try {
      wrapper.findComponent(WorkoutRoutineDayCard).vm.$emit('remove')
      await settle()
      expect(disabled('routine-day-delete-confirm')).toBe(false)
      await startRename()
      expect(disabled('routine-day-delete-confirm')).toBe(true)
      await finishWrite()
      expect(disabled('routine-day-delete-confirm')).toBe(false)
    } finally {
      gate.release()
      wrapper.unmount()
    }
  })

  it('locks the picker\'s new-exercise button and form save while a write is in flight', async () => {
    const wrapper = await mountSuspended(RoutinePage, { route: '/workouts/routines/3', attachTo: document.body })
    await flushPromises()
    try {
      wrapper.findComponent(WorkoutRoutineDayCard).vm.$emit('add-exercise')
      await settle()
      expect(disabled('exercise-new')).toBe(false)
      await startRename()
      expect(disabled('exercise-new')).toBe(true)
      await finishWrite()

      control('exercise-new').click()
      await settle()
      expect(disabled('exercise-submit')).toBe(false)
      await startRename()
      expect(disabled('exercise-submit')).toBe(true)
      await finishWrite()
      expect(disabled('exercise-submit')).toBe(false)
    } finally {
      gate.release()
      wrapper.unmount()
    }
  })

  it('locks the Active switch during a write and locks the editor while the switch writes', async () => {
    const wrapper = await mountSuspended(RoutinePage, { route: '/workouts/routines/3', attachTo: document.body })
    await flushPromises()
    try {
      expect(disabled('routine-active')).toBe(false)
      await startRename()
      expect(disabled('routine-active')).toBe(true)
      await finishWrite()
      expect(disabled('routine-active')).toBe(false)

      control('routine-active').click()
      await flushPromises()
      expect(disabled('routine-active')).toBe(true)
      expect(disabled('routine-name')).toBe(true)
      await finishWrite()
      expect(disabled('routine-name')).toBe(false)
    } finally {
      gate.release()
      wrapper.unmount()
    }
  })

  it('does not let a toggle start under a slower write whose stale response would land last', async () => {
    const sent: Record<string, unknown>[] = []
    patch.handler = async (event) => {
      const body = await readBody<Record<string, unknown>>(event)
      sent.push(body)
      if ('active' in body) return { ...routine, active: body.active }
      await waitForGate()
      return { ...routine, name: 'Renamed', active: false }
    }
    const wrapper = await mountSuspended(RoutinePage, { route: '/workouts/routines/3', attachTo: document.body })
    await flushPromises()
    try {
      await startRename()
      const activeSwitch = wrapper.findAllComponents({ name: 'USwitch' }).find((c) => c.props('label') === 'Active')!
      activeSwitch.vm.$emit('update:modelValue', true)
      await settle()
      await finishWrite()
      expect(sent.filter((body) => 'active' in body)).toEqual([])
      expect(control('routine-active').getAttribute('aria-checked')).toBe('false')
    } finally {
      gate.release()
      wrapper.unmount()
    }
  })

  it('keeps the pause-program flow: prompt opens, its confirm waits out a write, and a failure keeps the title', async () => {
    patch.handler = async (event) => {
      const body = await readBody<Record<string, unknown>>(event)
      if (body.pauseProgram) throw createError({ statusCode: 500, statusMessage: 'boom' })
      if ('active' in body) {
        throw createError({
          statusCode: 409,
          data: { code: 'program_controls_routine', program: { name: 'Strong 5x5' } }
        })
      }
      return gatedRename()
    }
    const wrapper = await mountSuspended(RoutinePage, { route: '/workouts/routines/3', attachTo: document.body })
    await flushPromises()
    try {
      control('routine-active').click()
      await settle()
      expect(q('pause-program-confirm')).not.toBeNull()
      expect(failTitles).toEqual([])
      expect(disabled('pause-program-confirm')).toBe(false)

      await startRename()
      expect(disabled('pause-program-confirm')).toBe(true)
      await finishWrite()
      expect(disabled('pause-program-confirm')).toBe(false)

      control('pause-program-confirm').click()
      await settle()
      expect(failTitles).toEqual(['Couldn\'t change active routine'])
      expect(disabled('routine-name')).toBe(false)
    } finally {
      gate.release()
      wrapper.unmount()
    }
  })
})
