import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import WorkoutToolsSheet from '../../app/components/workout/WorkoutToolsSheet.vue'

const entry = (id: number, name: string, plateSizes: number[] | null) => ({
  id, exerciseId: id + 100, exerciseName: name, sortOrder: id, trackingType: 'weight_reps' as const,
  loadStyle: plateSizes ? 'barbell' as const : 'plain' as const, barWeight: plateSizes ? 45 : null,
  weightIncrement: null, restSeconds: null, plateSizes, notes: null, target: null, supersetGroup: null, optional: false, restOverrideSeconds: null, sets: [], lastSets: []
})

const entries = [entry(1, 'Squat', [55, 45, 25, 10, 5, 2.5]), entry(2, 'Curl', null)]

const PLATES = [55, 45, 25, 10, 5, 2.5]
const found = (estimate: number) => ({
  estimate, source: { weight: 225, reps: 7, performedOn: '2026-09-02' }, assisted: false
})

function field(selector: string) {
  return document.body.querySelector(selector) as HTMLInputElement | null
}

async function type(selector: string, value: string) {
  const input = field(selector)!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

function text(selector: string) {
  return document.body.querySelector(selector)?.textContent ?? null
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('WorkoutToolsSheet', () => {
  it('uses the selected exercise\'s plates', async () => {
    const wrapper = await mountSuspended(WorkoutToolsSheet, {
      props: { entries, open: true, entryId: 1, tab: 'plates', target: 315 }
    })
    expect(document.body.querySelector('[data-test="plates-each-side"]')?.textContent).toBe('Each side: 55 · 55 · 25')
    wrapper.unmount()
  })

  it('hands the loaded weight to the selected entry', async () => {
    const wrapper = await mountSuspended(WorkoutToolsSheet, {
      props: { entries, open: true, entryId: 1, tab: 'plates', target: 315 }
    })
    ;(document.body.querySelector('[data-test="plates-use"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(wrapper.emitted('useWeight')).toEqual([[1, 315]])
    wrapper.unmount()
  })

  it('falls back to the profile plates and an editable bar with no exercise', async () => {
    const wrapper = await mountSuspended(WorkoutToolsSheet, {
      props: { entries, open: true, entryId: null, tab: 'plates', target: 315 }
    })
    expect(document.body.querySelector('[data-test="plates-each-side"]')?.textContent).toBe('Each side: 45 · 45 · 45')
    expect(document.body.querySelector('[data-test="tools-bar"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('fetches the selected exercise\'s 1RM when the tab opens', async () => {
    registerEndpoint('/api/workouts/exercises/101/one-rep-max', () => ({
      estimate: 253.1, source: { weight: 225, reps: 5, performedOn: '2026-09-02' }, assisted: false
    }))
    const wrapper = await mountSuspended(WorkoutToolsSheet, {
      props: { entries, open: true, entryId: 1, tab: 'one-rep-max', target: null }
    })
    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-test="one-rep-max-estimate"]')?.textContent).toContain('253.1')
    })
    wrapper.unmount()
  })

  it('clears the 1RM override when the exercise changes or the sheet closes', async () => {
    registerEndpoint('/api/workouts/exercises/105/one-rep-max', () => ({ estimate: null, source: null, assisted: false }))
    registerEndpoint('/api/workouts/exercises/106/one-rep-max', () => ({ estimate: null, source: null, assisted: false }))
    const lifts = [entry(5, 'Bench', PLATES), entry(6, 'Row', PLATES)]
    const wrapper = await mountSuspended(WorkoutToolsSheet, {
      props: { entries: lifts, open: true, entryId: 5, tab: 'one-rep-max', target: null }
    })
    await type('[data-test="override-weight"]', '200')
    await type('[data-test="override-reps"]', '3')
    await vi.waitFor(() => expect(text('[data-test="one-rep-max-estimate"]')).toContain('211.8'))

    await wrapper.setProps({ entryId: 6 })
    await vi.waitFor(() => expect(text('[data-test="one-rep-max-estimate"]')).toBeNull())

    await type('[data-test="override-weight"]', '200')
    await type('[data-test="override-reps"]', '3')
    await vi.waitFor(() => expect(text('[data-test="one-rep-max-estimate"]')).toContain('211.8'))
    await wrapper.setProps({ open: false })
    await flushPromises()
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => {
      expect(field('[data-test="override-weight"]')?.value).toBe('')
    })
    expect(text('[data-test="one-rep-max-estimate"]')).toBeNull()
    wrapper.unmount()
  })

  it('keeps the 1RM on screen when switching to Set calc', async () => {
    let calls = 0
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    registerEndpoint('/api/workouts/exercises/107/one-rep-max', async () => {
      calls += 1
      if (calls > 1) await held
      return found(262)
    })
    const wrapper = await mountSuspended(WorkoutToolsSheet, {
      props: { entries: [entry(7, 'Press', PLATES)], open: true, entryId: 7, tab: 'one-rep-max', target: null }
    })
    await vi.waitFor(() => expect(text('[data-test="one-rep-max-estimate"]')).toContain('262'))
    await wrapper.setProps({ tab: 'set-calc' })
    await vi.waitFor(() => expect(calls).toBe(2))
    expect(document.body.querySelector('[data-test="set-calc-skeleton"]')).toBeNull()
    expect(text('[data-test="set-calc-loadable"]')).toContain('225')
    release()
    await flushPromises()
    wrapper.unmount()
  })

  it('hands a Set calc weight to the Plates tab', async () => {
    registerEndpoint('/api/workouts/exercises/108/one-rep-max', () => found(262))
    const wrapper = await mountSuspended(WorkoutToolsSheet, {
      props: { entries: [entry(8, 'Deadlift', PLATES)], open: true, entryId: 8, tab: 'set-calc', target: null }
    })
    await vi.waitFor(() => expect(text('[data-test="set-calc-loadable"]')).toContain('225'))
    ;(document.body.querySelector('[data-test="set-calc-use"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(wrapper.emitted('update:target')?.at(-1)).toEqual([225])
    expect(wrapper.emitted('update:tab')?.at(-1)).toEqual(['plates'])
    wrapper.unmount()
  })
})
