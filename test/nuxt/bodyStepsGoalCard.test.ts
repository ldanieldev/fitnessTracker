import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import BodyStepsGoalCard from '../../app/components/body/BodyStepsGoalCard.vue'

let payload: unknown = { target: null }
registerEndpoint('/api/body/steps/target', () => payload)
afterEach(() => clearNuxtData('body:steps:target'))

describe('BodyStepsGoalCard', () => {
  it('shows the daily and weekly target and links to the steps page', async () => {
    payload = { target: { dailyTarget: 8000, effectiveFrom: '2026-08-24' } }
    const wrapper = await mountSuspended(BodyStepsGoalCard)
    expect(wrapper.find('[data-test="steps-goal-target"]').text()).toBe('8,000/day · 56,000/week')
    expect(wrapper.find('a[href="/body/steps"]').exists()).toBe(true)
  })

  it('says No target when none applies', async () => {
    payload = { target: null }
    const wrapper = await mountSuspended(BodyStepsGoalCard)
    expect(wrapper.find('[data-test="steps-goal-target"]').text()).toBe('No target')
  })
})
