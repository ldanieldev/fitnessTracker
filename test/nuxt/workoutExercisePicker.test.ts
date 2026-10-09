import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { getQuery } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import WorkoutExercisePicker from '../../app/components/workout/WorkoutExercisePicker.vue'

const category = { id: 1, key: 'chest', name: 'Chest', color: 'red' }
function exercise(id: number, name: string, shared: boolean) {
  return {
    id,
    name,
    shared,
    category,
    trackingType: 'weight_reps',
    loadStyle: 'plain',
    barWeight: null,
    equipment: [],
    primaryMuscles: [],
    secondaryMuscles: [],
    notes: null
  }
}

const find = (selector: string) => new DOMWrapper(document.querySelector(selector))
const input = () =>
  document.querySelector<HTMLInputElement>('[data-test="exercise-search"] input, input[data-test="exercise-search"]')!

async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

async function type(value: string) {
  const el = input()
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await settle()
}

function stub() {
  registerEndpoint('/api/workouts/exercises', {
    method: 'GET',
    handler: () => [exercise(1, 'Bench Press', true), exercise(2, 'My Curl', false)]
  })
  registerEndpoint('/api/workouts/exercises', {
    method: 'POST',
    handler: () => exercise(9, 'Cable Fly', false)
  })
  registerEndpoint('/api/workouts/reference', () => ({
    categories: [category],
    muscles: [],
    equipment: []
  }))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('WorkoutExercisePicker', () => {
  it('asks the server once per search while open, and again after reopening', async () => {
    const seen: string[] = []
    registerEndpoint('/api/workouts/exercises', {
      method: 'GET',
      handler: (event) => {
        seen.push(String(getQuery(event).q ?? ''))
        return [exercise(1, 'Bench Press', true)]
      }
    })
    const typeAndWait = async (value: string) => {
      await type(value)
      await new Promise((resolve) => setTimeout(resolve, 250))
      await settle()
    }
    const wrapper = await mountSuspended(WorkoutExercisePicker, { attachTo: document.body, props: { open: true } })
    await settle()
    await typeAndWait('curl')
    await typeAndWait('cur')
    await typeAndWait('curl')
    expect(seen).toEqual(['', 'curl', 'cur'])
    expect(document.querySelectorAll('[data-test="exercise-row"]')).toHaveLength(1)
    await wrapper.setProps({ open: false })
    await settle()
    await wrapper.setProps({ open: true })
    await settle()
    expect(seen).toEqual(['', 'curl', 'cur', ''])
    wrapper.unmount()
  })

  it('keeps the reopened list when a request from the previous open lands late', async () => {
    let calls = 0
    registerEndpoint('/api/workouts/exercises', {
      method: 'GET',
      handler: async () => {
        const call = ++calls
        if (call === 1) {
          await new Promise((resolve) => setTimeout(resolve, 80))
          return [exercise(1, 'Old Row', true)]
        }
        return [exercise(2, 'New Row', true)]
      }
    })
    const wrapper = await mountSuspended(WorkoutExercisePicker, { attachTo: document.body, props: { open: true } })
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 120))
    await flushPromises()
    const names = [...document.querySelectorAll('[data-test="exercise-row"]')].map((row) => row.textContent?.trim())
    expect(calls).toBe(2)
    expect(names).toEqual(['New Row'])
    wrapper.unmount()
  })

  it('starts empty each time the parent opens it', async () => {
    stub()
    const wrapper = await mountSuspended(WorkoutExercisePicker, { attachTo: document.body, props: { open: true } })
    await settle()
    await type('curl')
    expect(input().value).toBe('curl')
    await wrapper.setProps({ open: false })
    await settle()
    await wrapper.setProps({ open: true })
    await settle()
    expect(input().value).toBe('')
    wrapper.unmount()
  })

  it('shows a pencil only on user-owned rows and does not pick when it is tapped', async () => {
    stub()
    const wrapper = await mountSuspended(WorkoutExercisePicker, { attachTo: document.body, props: { open: false } })
    await wrapper.setProps({ open: true })
    await settle()
    expect(find('[data-test="exercise-row-edit-1"]').exists()).toBe(false)
    expect(find('[data-test="exercise-row-edit-2"]').exists()).toBe(true)
    await find('[data-test="exercise-row-edit-2"]').trigger('click')
    await settle()
    expect(wrapper.emitted('pick')).toBeUndefined()
    expect(find('[data-test="exercise-name"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens the form prefilled with the search and emits pick for the created exercise', async () => {
    stub()
    const wrapper = await mountSuspended(WorkoutExercisePicker, { attachTo: document.body, props: { open: true } })
    await settle()
    await type('Cable Fly')
    await find('[data-test="exercise-new"]').trigger('click')
    await settle()
    const name = document.querySelector<HTMLInputElement>(
      'input[data-test="exercise-name"], [data-test="exercise-name"] input'
    )!
    expect(name.value).toBe('Cable Fly')
    await find('[data-test="exercise-submit"]').trigger('click')
    await settle()
    expect(wrapper.emitted('pick')![0]).toEqual([9])
    wrapper.unmount()
  })
})
