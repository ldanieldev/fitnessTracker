import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import WorkoutProgressPage from '../../app/pages/workouts/progress.vue'

const progress = {
  from: '2026-09-01',
  to: '2026-09-20',
  totals: { workouts: 3, sets: 20, reps: 140, volume: 12000, durationSeconds: 5400 },
  muscles: [],
  goals: []
}

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('workouts/progress page', () => {
  it('disables Apply and explains why for a reversed custom date pair', async () => {
    registerEndpoint('/api/workouts/progress', () => progress)
    const wrapper = await mountSuspended(WorkoutProgressPage, { attachTo: document.body })
    await flushPromises()

    ;(document.querySelector('[data-test="progress-custom-open"]') as HTMLButtonElement).click()
    await flushPromises()

    const from = document.querySelector('input[data-test="progress-from"]') as HTMLInputElement
    const to = document.querySelector('input[data-test="progress-to"]') as HTMLInputElement
    typeInto(from, '2026-09-20')
    typeInto(to, '2026-09-01')
    await flushPromises()

    expect(document.querySelector('[data-test="progress-custom-error"]')).not.toBeNull()
    expect((document.querySelector('[data-test="progress-custom-apply"]') as HTMLButtonElement).disabled).toBe(true)

    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('shows an error state instead of zeroed tiles when the fetch fails', async () => {
    registerEndpoint('/api/workouts/progress', () => {
      throw createError({ statusCode: 400, statusMessage: 'from must be before to' })
    })
    const wrapper = await mountSuspended(WorkoutProgressPage, { attachTo: document.body })
    await flushPromises()

    expect(document.querySelector('[data-test="progress-error"]')).not.toBeNull()
    expect(document.querySelector('[data-test="progress-total-workouts"]')).toBeNull()
    expect(document.querySelector('[data-test="progress-goals-empty"]')).toBeNull()

    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('states cardio goals in miles and m:ss per mile', async () => {
    const goal = { targetReps: null, targetDate: null, achievedAt: null, lowerIsBetter: false, reached: false }
    registerEndpoint('/api/workouts/progress', () => ({
      ...progress,
      goals: [
        { ...goal, exerciseId: 3, exerciseName: 'Run', metric: 'distance', targetValue: 16093.44, current: 8046.72 },
        { ...goal, exerciseId: 4, exerciseName: 'Tempo', metric: 'pace', targetValue: 1609.344 / 480, current: 5000 / 1500 },
        { ...goal, exerciseId: 5, exerciseName: 'Bench', metric: 'max_weight', targetValue: 225, current: 185 }
      ]
    }))
    const wrapper = await mountSuspended(WorkoutProgressPage, { attachTo: document.body })
    await flushPromises()
    const values = [...document.querySelectorAll('[data-test="progress-goal-values"]')].map((p) => p.textContent!.replace(/\s+/g, ' ').trim())
    expect(values).toEqual(['5 / 10 mi', '8:03 / 8:00 /mi', '185 / 225 lb'])
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
