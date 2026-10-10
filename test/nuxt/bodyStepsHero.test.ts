import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BodyStepsHero from '../../app/components/body/BodyStepsHero.vue'
import { summarizeWeek } from '../../shared/utils/steps'

const TODAY = '2026-10-09'
const days = [
  { date: '2026-10-04', steps: 8229 },
  { date: '2026-10-05', steps: 10794 },
  { date: '2026-10-06', steps: 5722 },
  { date: '2026-10-08', steps: 7950 }
]

describe('BodyStepsHero', () => {
  it('shows the week against the budget as a ring and numbers, and Log emits log', async () => {
    const week = summarizeWeek('2026-10-04', days, [{ dailyTarget: 8000, effectiveFrom: '2026-01-01' }], TODAY)
    const wrapper = await mountSuspended(BodyStepsHero, { props: { week } })
    expect(wrapper.find('[data-test="steps-ring"]').text()).toContain('58%')
    expect(wrapper.find('[data-test="steps-hero-total"]').text()).toBe('32,695')
    expect(wrapper.text()).toContain('of 56,000')
    expect(wrapper.text()).toContain('23,305 left · 2 days → 11,653/day')
    expect(wrapper.find('[data-test="steps-hero-set-target"]').exists()).toBe(false)
    await wrapper.find('[data-test="steps-hero-log"]').trigger('click')
    expect(wrapper.emitted('log')).toHaveLength(1)
  })

  it('without a target shows the total only and offers Set a target', async () => {
    const week = summarizeWeek('2026-10-04', days, [], TODAY)
    const wrapper = await mountSuspended(BodyStepsHero, { props: { week } })
    expect(wrapper.find('[data-test="steps-ring"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="steps-hero-total"]').text()).toBe('32,695')
    await wrapper.find('[data-test="steps-hero-set-target"]').trigger('click')
    expect(wrapper.emitted('setTarget')).toHaveLength(1)
  })
})
