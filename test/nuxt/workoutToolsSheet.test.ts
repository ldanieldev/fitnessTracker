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
})
