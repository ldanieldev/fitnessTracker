import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { clearNuxtData } from 'nuxt/app'
import DashboardTodayStrip from '../../app/components/dashboard/DashboardTodayStrip.vue'
import { useToday } from '../../app/composables/useToday'
import { todayDate } from '../../shared/utils/nutritionSummary'

const today = todayDate()
const { start, navigate, starting, refreshData, modules } = await vi.hoisted(async () => {
  const { computed, ref } = await import('vue')
  const shown = { body: ref(true), workouts: ref(true), nutrition: ref(true) }
  return {
    start: vi.fn(),
    navigate: vi.fn(),
    starting: ref(false),
    refreshData: vi.fn(),
    modules: {
      shown,
      api: {
        body: computed(() => shown.body.value),
        workouts: computed(() => shown.workouts.value),
        nutrition: computed(() => shown.nutrition.value)
      }
    }
  }
})
mockNuxtImport('useWorkoutStart', () => () => ({ start, starting }))
mockNuxtImport('navigateTo', () => navigate)
mockNuxtImport('useModules', () => () => modules.api)
mockNuxtImport('refreshNuxtData', () => refreshData)

let overview: unknown[] = []
let overviewFails = false
let day: unknown = null
let weeks: unknown[] = []
let stepsGate: Promise<void> | null = null
let active: unknown = null
let routines: unknown[] = []
let consistency: unknown = null
let note: string | null = null
const calls = new Map<string, number>()
const hit = (path: string) => calls.set(path, (calls.get(path) ?? 0) + 1)
registerEndpoint('/api/body/overview', () => {
  hit('overview')
  if (overviewFails) throw createError({ statusCode: 500 })
  return overview
})
registerEndpoint(`/api/nutrition/diary/${today}`, () => {
  hit('diary')
  return day
})
registerEndpoint('/api/nutrition/nutrients/tracked', () => [
  { key: 'energy', name: 'Energy', unit: 'kcal', sortOrder: 0 },
  { key: 'protein', name: 'Protein', unit: 'g', sortOrder: 1 }
])
registerEndpoint('/api/nutrition/goal-profiles', () => [])
registerEndpoint('/api/body/steps/weeks', async () => {
  hit('steps')
  if (stepsGate) await stepsGate
  return weeks
})
registerEndpoint('/api/workouts/sessions/active', () => {
  hit('active')
  return active
})
registerEndpoint('/api/workouts/routines', () => {
  hit('routines')
  return routines
})
registerEndpoint('/api/workouts/enrollment/sync', {
  method: 'POST',
  handler: () => {
    hit('enrollment')
    return null
  }
})
registerEndpoint('/api/dashboard/consistency', () => {
  hit('consistency')
  return consistency
})
registerEndpoint(`/api/days/${today}/note`, () => {
  hit('note')
  return { date: today, note }
})

const wrappers: VueWrapper[] = []

beforeEach(() => {
  useToday().value = today
})

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  clearNuxtData()
  start.mockReset()
  navigate.mockReset()
  refreshData.mockReset()
  calls.clear()
  for (const shown of Object.values(modules.shown)) shown.value = true
  overview = []
  overviewFails = false
  day = null
  weeks = []
  stepsGate = null
  active = null
  routines = []
  consistency = null
  note = null
})

const bodyweight = (measuredOn: string) => [
  {
    type: {
      id: 1,
      key: 'bodyweight',
      name: 'Bodyweight',
      unit: 'lbs',
      precision: 1,
      direction: 'neutral',
      builtIn: true,
      hidden: false,
      sortOrder: 0
    },
    latest: { id: 1, typeId: 1, value: 181.4, measuredAt: `${measuredOn}T08:00:00.000Z`, measuredOn },
    previous: null,
    goal: null,
    sparkline: []
  }
]

const diary = (eaten: number, protein = 0, energy = 2000) => ({
  date: today,
  persisted: true,
  notes: null,
  goalProfileId: null,
  targets: [
    { key: 'energy', name: 'Energy', unit: 'kcal', amount: energy, direction: 'target' },
    { key: 'protein', name: 'Protein', unit: 'g', amount: 180, direction: 'min' }
  ],
  containers: [],
  entries: [],
  totals: { energy: eaten, protein }
})

const stepWeek = (steps: number | null, target: number | null) => [
  {
    start: today,
    end: today,
    days: [{ date: today, steps, partial: false, target }],
    total: steps ?? 0,
    logged: 1,
    average: null,
    budget: null,
    met: null,
    remaining: null,
    openDays: null,
    neededPerDay: null
  }
]

const consistencyWith = (days: string[]) => ({
  weekStart: 0,
  weeks: [],
  days,
  streak: 0,
  best: 0,
  thisWeek: { count: 0, target: 3 },
  targetSource: 'setting'
})

async function mounted() {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  clearNuxtData()
  calls.clear()
  const wrapper = await mountSuspended(DashboardTodayStrip)
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

const row = (wrapper: Awaited<ReturnType<typeof mounted>>, key: string) => wrapper.find(`[data-test="today-${key}"]`)

const openSession = {
  id: 3,
  name: 'Push',
  performedOn: today,
  startedAt: `${today}T08:00:00.000Z`,
  endedAt: null,
  notes: null,
  routineDayId: null,
  deload: false,
  entries: []
}

describe('DashboardTodayStrip', () => {
  it('ticks the weigh-in only when it was logged today', async () => {
    overview = bodyweight(today)
    let wrapper = await mounted()
    expect(row(wrapper, 'weighIn').attributes('data-state')).toBe('done')
    expect(row(wrapper, 'weighIn').find('[data-test="today-value"]').text()).toBe('181.4 lbs')
    expect(row(wrapper, 'weighIn').find('[data-test="today-log-weight"]').exists()).toBe(false)
    overview = bodyweight('2026-01-01')
    wrapper = await mounted()
    expect(row(wrapper, 'weighIn').attributes('data-state')).toBe('open')
    expect(row(wrapper, 'weighIn').find('[data-test="today-value"]').text()).toBe('Not yet today')
    expect(row(wrapper, 'weighIn').text()).toContain('Last 181.4 lbs · Thu, Jan 1')
    expect(row(wrapper, 'weighIn').find('a').attributes('href')).toBe('/body/1')
    expect(row(wrapper, 'weighIn').find('[data-test="today-log-weight"]').exists()).toBe(true)
  })

  it('judges calories within ±10% of the target and warns when far over', async () => {
    for (const [eaten, state, text] of [
      [0, 'open', '2,000 kcal left'],
      [1850, 'done', '150 kcal left'],
      [2150, 'done', '150 kcal over'],
      [2400, 'warn', '400 kcal over']
    ] as const) {
      day = diary(eaten, 60)
      const wrapper = await mounted()
      expect(row(wrapper, 'calories').attributes('data-state')).toBe(state)
      expect(row(wrapper, 'calories').find('[data-test="today-value"]').text()).toBe(text)
      expect(row(wrapper, 'calories').text()).toContain('Protein 120 g left')
    }
  })

  it('compares steps with the target and offers a goal without one', async () => {
    weeks = stepWeek(6000, 8000)
    let wrapper = await mounted()
    expect(row(wrapper, 'steps').attributes('data-state')).toBe('open')
    expect(row(wrapper, 'steps').find('[data-test="today-value"]').text()).toBe('2,000 to go')
    expect(row(wrapper, 'steps').text()).toContain('6,000 of 8,000')
    weeks = stepWeek(9000, 8000)
    wrapper = await mounted()
    expect(row(wrapper, 'steps').attributes('data-state')).toBe('done')
    expect(row(wrapper, 'steps').find('[data-test="today-value"]').text()).toBe('9,000 steps')
    weeks = stepWeek(null, null)
    wrapper = await mounted()
    expect(row(wrapper, 'steps').attributes('data-state')).toBe('open')
    expect(row(wrapper, 'steps').text()).toContain('Set a goal')
  })

  it('starts the next routine day and opens the log', async () => {
    routines = [{ id: 5, name: 'BLS', active: true, dayCount: 4, nextDay: { id: 9, name: 'Back & Calves' } }]
    consistency = consistencyWith([])
    start.mockResolvedValue({ id: 1 })
    const wrapper = await mounted()
    expect(row(wrapper, 'workout').find('[data-test="today-value"]').text()).toBe('Back & Calves')
    await row(wrapper, 'workout').find('[data-test="today-start"]').trigger('click')
    await flushPromises()
    expect(start).toHaveBeenCalledWith({ routineDayId: 9 })
    expect(navigate).toHaveBeenCalledWith('/workouts/log')
  })

  it('starts an empty workout when no routine day is due', async () => {
    consistency = consistencyWith([])
    start.mockResolvedValue(null)
    const wrapper = await mounted()
    expect(row(wrapper, 'workout').find('[data-test="today-value"]').text()).toBe('No workout planned')
    await row(wrapper, 'workout').find('[data-test="today-start"]').trigger('click')
    await flushPromises()
    expect(start).toHaveBeenCalledWith({})
    expect(navigate).not.toHaveBeenCalled()
  })

  it('ticks the workout when a session finished today and offers Resume for an open one', async () => {
    consistency = consistencyWith([today])
    let wrapper = await mounted()
    expect(row(wrapper, 'workout').attributes('data-state')).toBe('done')
    expect(row(wrapper, 'workout').find('[data-test="today-start"]').exists()).toBe(false)
    consistency = consistencyWith([])
    active = openSession
    wrapper = await mounted()
    expect(row(wrapper, 'workout').attributes('data-state')).toBe('open')
    expect(row(wrapper, 'workout').find('[data-test="today-value"]').text()).toBe('Push')
    expect(row(wrapper, 'workout').text()).toContain('In progress')
    expect(row(wrapper, 'workout').find('[data-test="today-resume"]').attributes('href')).toBe('/workouts/log')
    expect(row(wrapper, 'workout').find('[data-test="today-start"]').exists()).toBe(false)
  })

  it('keeps the action buttons outside the row link', async () => {
    overview = bodyweight('2026-01-01')
    consistency = consistencyWith([])
    const wrapper = await mounted()
    for (const key of ['weighIn', 'workout']) {
      expect(row(wrapper, key).find('a').element.querySelector('button')).toBeNull()
    }
  })

  it('shows a skeleton row while a row is loading', async () => {
    let release = () => {}
    stepsGate = new Promise((resolve) => {
      release = resolve
    })
    weeks = stepWeek(9000, 8000)
    const wrapper = await mounted()
    expect(row(wrapper, 'steps').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="today-skeleton"]')).toHaveLength(1)
    release()
    await flushPromises()
    await vi.waitFor(() => expect(row(wrapper, 'steps').attributes('data-state')).toBe('done'))
    expect(wrapper.find('[data-test="today-skeleton"]').exists()).toBe(false)
  })

  it('degrades a row to a dash on its own fetch error', async () => {
    overviewFails = true
    weeks = stepWeek(9000, 8000)
    const wrapper = await mounted()
    expect(row(wrapper, 'weighIn').attributes('data-state')).toBe('open')
    expect(row(wrapper, 'weighIn').find('[data-test="today-value"]').text()).toBe('—')
    expect(row(wrapper, 'weighIn').find('[data-test="today-log-weight"]').exists()).toBe(false)
    expect(row(wrapper, 'steps').attributes('data-state')).toBe('done')
  })

  it('prefers Resume over a session already finished today', async () => {
    consistency = consistencyWith([today])
    active = openSession
    const wrapper = await mounted()
    expect(row(wrapper, 'workout').attributes('data-state')).toBe('open')
    expect(row(wrapper, 'workout').find('.i-lucide-check').exists()).toBe(false)
    expect(row(wrapper, 'workout').text()).toContain('In progress')
    expect(row(wrapper, 'workout').find('[data-test="today-resume"]').exists()).toBe(true)
  })

  it('treats an energy target of 0 as no target', async () => {
    day = diary(500, 0, 0)
    const wrapper = await mounted()
    expect(row(wrapper, 'calories').attributes('data-state')).toBe('open')
    expect(row(wrapper, 'calories').find('[data-test="today-value"]').text()).toBe('500 kcal eaten')
  })

  it('names each row state for screen readers', async () => {
    overview = bodyweight(today)
    day = diary(2400)
    weeks = stepWeek(6000, 8000)
    consistency = consistencyWith([])
    const wrapper = await mounted()
    const state = (key: string) => row(wrapper, key).find('.sr-only').text()
    expect(state('weighIn')).toBe('done')
    expect(state('calories')).toBe('over target')
    expect(state('steps')).toBe('not done')
    expect(state('workout')).toBe('not done')
  })

  it('fetches and shows only the rows of visible modules', async () => {
    modules.shown.body.value = false
    modules.shown.workouts.value = false
    day = diary(500)
    const wrapper = await mounted()
    expect(wrapper.findAll('[data-test^="today-"][data-state]').map((r) => r.attributes('data-test'))).toEqual([
      'today-calories'
    ])
    for (const source of ['overview', 'steps', 'active', 'routines', 'enrollment', 'consistency']) {
      expect(calls.get(source) ?? 0, source).toBe(0)
    }
    expect(calls.get('diary')).toBe(1)
  })

  it('skips the nutrition fetch when nutrition is hidden', async () => {
    modules.shown.nutrition.value = false
    await mounted()
    expect(calls.get('diary') ?? 0).toBe(0)
    expect(calls.get('overview')).toBe(1)
  })

  it('drops a module’s rows when it is switched off while mounted', async () => {
    day = diary(500)
    const wrapper = await mounted()
    modules.shown.body.value = false
    modules.shown.workouts.value = false
    await flushPromises()
    expect(wrapper.findAll('[data-test^="today-"][data-state]').map((r) => r.attributes('data-test'))).toEqual([
      'today-calories'
    ])
    modules.shown.nutrition.value = false
    await flushPromises()
    expect(wrapper.find('[data-test="dashboard-today-strip"]').exists()).toBe(false)
  })

  it('renders nothing when every module is hidden', async () => {
    for (const shown of Object.values(modules.shown)) shown.value = false
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="dashboard-today-strip"]').exists()).toBe(false)
    expect([...calls.values()].reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('refreshes the bodyweight trend after a weigh-in is saved', async () => {
    overview = bodyweight('2026-01-01')
    const wrapper = await mounted()
    wrapper.findComponent({ name: 'BodyEntrySheet' }).vm.$emit('saved')
    expect(refreshData).toHaveBeenCalledWith('dashboard:bodyweight')
  })

  it('shows today’s note under the rows, or a prompt to add one', async () => {
    day = diary(500)
    note = 'Event day, ate out'
    let wrapper = await mounted()
    expect(row(wrapper, 'note-text').text()).toBe('Event day, ate out')
    expect(row(wrapper, 'note-edit').attributes('aria-label')).toBe('Edit today’s note')
    note = null
    wrapper = await mounted()
    expect(row(wrapper, 'note-text').text()).toBe('Nothing noted today')
    expect(row(wrapper, 'note-edit').attributes('aria-label')).toBe('Add a note for today')
    expect(calls.get('note')).toBe(1)
  })
})
