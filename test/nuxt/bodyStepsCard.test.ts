import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import { useToday } from '../../app/composables/useToday'
import BodyStepsCard from '../../app/components/body/BodyStepsCard.vue'
import { summarizeWeek } from '../../shared/utils/steps'

const TODAY = '2026-10-07'
let payload: unknown[] = []
registerEndpoint('/api/body/steps/weeks', () => payload)

afterEach(() => {
  clearNuxtData('body:steps:weeks:2')
})

const eight = [{ dailyTarget: 8000, effectiveFrom: '2026-01-01' }]

describe('BodyStepsCard', () => {
  it('shows this week against the budget, today, and the pace line', async () => {
    useToday().value = TODAY
    payload = [
      summarizeWeek(
        '2026-10-04',
        [
          { date: '2026-10-04', steps: 8000 },
          { date: '2026-10-05', steps: 8000 },
          { date: '2026-10-06', steps: 8000 },
          { date: TODAY, steps: 4000 }
        ],
        eight,
        TODAY
      ),
      summarizeWeek('2026-09-27', [], eight, TODAY)
    ]
    const wrapper = await mountSuspended(BodyStepsCard)
    expect(wrapper.find('[data-test="steps-total"]').text()).toBe('28,000')
    expect(wrapper.find('[data-test="steps-budget"]').text()).toContain('56,000')
    expect(wrapper.find('[data-test="steps-today"]').text()).toContain('4,000')
    expect(wrapper.find('[data-test="steps-pace"]').text()).toBe('28,000 left · 3 days → 9,334/day')
    expect(wrapper.find('a[data-test="steps-link"]').attributes('href')).toBe('/body/steps')
    expect(wrapper.find('[data-test="steps-set-target"]').exists()).toBe(false)
  })

  it('offers Set a target when no target applies, and shows a dash for an unlogged today', async () => {
    useToday().value = TODAY
    payload = [
      summarizeWeek('2026-10-04', [{ date: '2026-10-04', steps: 5000 }], [], TODAY),
      summarizeWeek('2026-09-27', [], [], TODAY)
    ]
    const wrapper = await mountSuspended(BodyStepsCard)
    expect(wrapper.find('[data-test="steps-total"]').text()).toBe('5,000')
    expect(wrapper.find('[data-test="steps-today"]').text()).toContain('—')
    expect(wrapper.find('[data-test="steps-budget"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="steps-pace"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="steps-set-target"]').exists()).toBe(true)
  })

  it('opens the log sheet from Log and the target sheet from Set a target', async () => {
    useToday().value = TODAY
    payload = [
      summarizeWeek('2026-10-04', [{ date: '2026-10-04', steps: 5000 }], [], TODAY),
      summarizeWeek('2026-09-27', [], [], TODAY)
    ]
    const wrapper = await mountSuspended(BodyStepsCard, { attachTo: document.body })
    await wrapper.find('[data-test="steps-log"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Log steps')
    await wrapper.find('[data-test="steps-set-target"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Steps target')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('knows a day logged in the previous week', async () => {
    useToday().value = '2026-10-04'
    payload = [
      summarizeWeek('2026-10-04', [], eight, '2026-10-04'),
      summarizeWeek('2026-09-27', [{ date: '2026-10-03', steps: 7000 }], eight, '2026-10-04')
    ]
    const wrapper = await mountSuspended(BodyStepsCard)
    const known = wrapper.findComponent({ name: 'BodyStepsSheet' }).props('known')
    expect(known).toEqual({ '2026-10-03': 7000 })
    wrapper.unmount()
  })

  it('makes the whole card body a link while Log and Set a target stay separate buttons', async () => {
    useToday().value = TODAY
    payload = [summarizeWeek('2026-10-04', [], [], TODAY), summarizeWeek('2026-09-27', [], [], TODAY)]
    const wrapper = await mountSuspended(BodyStepsCard)
    const link = wrapper.find('a[data-test="steps-link"]')
    expect(link.classes()).toContain('after:absolute')
    expect(link.element.querySelector('button')).toBeNull()
    expect(wrapper.find('[data-test="steps-log"]').classes()).toContain('z-10')
    expect(wrapper.find('[data-test="steps-set-target"]').classes()).toContain('z-10')
  })
})
