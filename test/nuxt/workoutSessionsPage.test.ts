import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { getQuery, readBody, type H3Event } from 'h3'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import SessionsPage from '../../app/pages/workouts/sessions/index.vue'

const { calls } = vi.hoisted(() => ({ calls: [] as Array<Record<string, string>> }))

// The global auth middleware runs on the test navigation, so the session must read as signed in.
mockNuxtImport('useUserSession', () => () => ({
  loggedIn: { value: true },
  user: { value: { id: 1, weekStart: 1 } },
  fetch: vi.fn(),
  clear: vi.fn()
}))

const TOTAL = 25
const summary = (id: number) => ({
  id,
  name: `W${id}`,
  performedOn: '2026-09-01',
  startedAt: '2026-09-01T15:00:00.000Z',
  endedAt: '2026-09-01T16:00:00.000Z',
  exerciseCount: 1,
  setCount: 3,
  categories: [],
  program: null
})
registerEndpoint('/api/workouts/sessions', {
  method: 'GET',
  handler: (event: H3Event) => {
    const query = getQuery(event) as Record<string, string>
    calls.push(query)
    return Array.from({ length: Math.min(Number(query.limit), TOTAL) }, (_, i) => summary(i + 1))
  }
})
registerEndpoint('/api/workouts/programs', async () => {
  await new Promise((resolve) => setTimeout(resolve, 50))
  return [{ id: 7, name: 'BLS', phaseCount: 1, totalWeeks: 4, enrolled: true }]
})
registerEndpoint('/api/workouts/reference', () => ({
  categories: [{ id: 1, key: 'chest', name: 'chest', color: 'rose', sortOrder: 1, shared: true, hidden: false }],
  muscles: [],
  equipment: []
}))

const settle = async () => {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 120))
  await flushPromises()
}
const q = (sel: string) => document.querySelector<HTMLElement>(`[data-test="${sel}"]`)

afterEach(() => {
  calls.length = 0
  clearNuxtData()
  document.body.innerHTML = ''
})

describe('workouts/sessions page', () => {
  it('waits for the program list before using a program from the URL, then drops a stale one', async () => {
    const wrapper = await mountSuspended(SessionsPage, { route: '/workouts/sessions?view=list&prog=99&phase=5' })
    await settle()
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((query) => query.programId === undefined && query.phaseId === undefined)).toBe(true)
    expect(useRouter().currentRoute.value.query.prog).toBeUndefined()
    wrapper.unmount()
  })

  it('drops a stale program from the URL even when the program list is already cached', async () => {
    const wrapper = await mountSuspended(SessionsPage, { route: '/workouts/sessions?view=list' })
    await settle()
    await useRouter().replace('/workouts/sessions?view=list&prog=99&phase=5')
    await settle()
    expect(useRouter().currentRoute.value.query.prog).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps a known program from the URL on every request', async () => {
    const wrapper = await mountSuspended(SessionsPage, { route: '/workouts/sessions?view=list&prog=7' })
    await settle()
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((query) => query.programId === '7')).toBe(true)
    wrapper.unmount()
  })

  it('pages by twenty, stops at the end, and starts over at one page when the filter changes', async () => {
    const wrapper = await mountSuspended(SessionsPage, {
      route: '/workouts/sessions?view=list',
      attachTo: document.body
    })
    await settle()
    expect(document.querySelectorAll('[data-test="session-row"]')).toHaveLength(20)
    q('session-load-more')!.click()
    await settle()
    expect(calls.at(-1)!.limit).toBe('40')
    expect(document.querySelectorAll('[data-test="session-row"]')).toHaveLength(25)
    expect(q('session-load-more')).toBeNull()

    q('history-filter-open')!.click()
    await settle()
    q('filter-category-1')!.click()
    await settle()
    q('filter-apply')!.click()
    await settle()
    const filtered = calls.filter((query) => query.categories === '1')
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((query) => query.limit === '20')).toBe(true)
    wrapper.unmount()
  })

  it('changes a workout date from the row menu and deletes only after confirming', async () => {
    const patches: unknown[] = []
    let deleted = 0
    registerEndpoint('/api/workouts/sessions/1', {
      method: 'PATCH',
      handler: async (event: H3Event) => {
        patches.push(await readBody(event))
        return {}
      }
    })
    registerEndpoint('/api/workouts/sessions/1', {
      method: 'DELETE',
      handler: () => {
        deleted++
        return null
      }
    })
    const wrapper = await mountSuspended(SessionsPage, {
      route: '/workouts/sessions?view=list',
      attachTo: document.body
    })
    await settle()

    await wrapper.find('[data-test="session-menu-1"]').trigger('click')
    await settle()
    q('session-times-1')!.click()
    await settle()
    const start = document.querySelector<HTMLInputElement>('input[data-test="session-start-input"]')!
    start.value = '2026-08-30T07:15'
    start.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    q('session-times-save')!.click()
    await settle()
    expect(patches).toHaveLength(1)
    expect(patches[0]).toMatchObject({ performedOn: '2026-08-30' })

    await wrapper.find('[data-test="session-menu-1"]').trigger('click')
    await settle()
    q('session-delete-1')!.click()
    await settle()
    expect(q('session-delete')).toBeNull()
    expect(deleted).toBe(0)
    q('history-delete-confirm')!.click()
    await settle()
    expect(deleted).toBe(1)
    wrapper.unmount()
  })
})
