import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BodyStepsWeekChart from '../../app/components/body/BodyStepsWeekChart.vue'
import { summarizeWeek } from '../../shared/utils/steps'

const eight = [{ dailyTarget: 8000, effectiveFrom: '2026-01-01' }]
const week = summarizeWeek(
  '2026-10-04',
  [
    { date: '2026-10-04', steps: 8229 },
    { date: '2026-10-05', steps: 10794 },
    { date: '2026-10-06', steps: 5722 },
    { date: '2026-10-08', steps: 7950 }
  ],
  eight,
  '2026-10-09'
)
const TODAY = '2026-10-09'

describe('BodyStepsWeekChart', () => {
  it('draws a bar per logged day with a compact label, a check on hits and a dashed + slot for open days', async () => {
    const wrapper = await mountSuspended(BodyStepsWeekChart, { props: { week, today: TODAY, lastWeekTotal: 57604 } })
    expect(wrapper.findAll('[data-test^="steps-day-"]')).toHaveLength(7)
    expect(wrapper.find('[data-test="steps-count-2026-10-05"]').text()).toBe('10.7k')
    expect(wrapper.find('[data-test="steps-count-2026-10-08"]').text()).toBe('7.9k')
    expect(wrapper.find('[data-test="steps-hit-2026-10-04"]').text()).toBe('Target met')
    expect(wrapper.find('[data-test="steps-hit-2026-10-06"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="steps-add-2026-10-07"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="steps-add-2026-10-09"]').attributes('data-today')).toBe('true')
    expect(wrapper.find('[data-test="steps-add-2026-10-10"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="steps-day-2026-10-10"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('57,604')
  })

  it('scales bars to the larger of the target and the best day, with the target line at the target', async () => {
    const wrapper = await mountSuspended(BodyStepsWeekChart, { props: { week, today: TODAY, lastWeekTotal: null } })
    const best = wrapper.find('[data-test="steps-bar-2026-10-05"]').attributes('style')
    const under = wrapper.find('[data-test="steps-bar-2026-10-06"]').attributes('style')
    expect(best).toContain('height: 100%')
    expect(under).toContain(`height: ${(5722 / 10794) * 100}%`)
    expect(wrapper.find('[data-test="steps-target-line"]').attributes('style')).toContain(
      `bottom: ${(8000 / 10794) * 100}%`
    )
    expect(wrapper.text()).toContain('Last week')
    expect(wrapper.text()).toContain('—')
  })

  it('names each day for screen readers and emits the date on click', async () => {
    const wrapper = await mountSuspended(BodyStepsWeekChart, { props: { week, today: TODAY, lastWeekTotal: 57604 } })
    expect(wrapper.find('[data-test="steps-day-2026-10-05"]').attributes('aria-label')).toBe(
      'Edit steps for Mon, Oct 5, 10,794 steps'
    )
    expect(wrapper.find('[data-test="steps-day-2026-10-09"]').attributes('aria-label')).toBe('Log steps for Fri, Oct 9')
    await wrapper.find('[data-test="steps-day-2026-10-07"]').trigger('click')
    expect(wrapper.emitted('pick')).toEqual([['2026-10-07']])
  })

  it('has no target line when no target applies', async () => {
    const plain = summarizeWeek('2026-10-04', [{ date: '2026-10-04', steps: 5000 }], [], TODAY)
    const wrapper = await mountSuspended(BodyStepsWeekChart, {
      props: { week: plain, today: TODAY, lastWeekTotal: null }
    })
    expect(wrapper.find('[data-test="steps-target-line"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="steps-bar-2026-10-04"]').attributes('style')).toContain('height: 100%')
  })

  it('drops the check from a hit bar too short to hold it, keeping it for screen readers', async () => {
    const lopsided = summarizeWeek(
      '2026-10-04',
      [
        { date: '2026-10-04', steps: 200000 },
        { date: '2026-10-05', steps: 15929 }
      ],
      eight,
      TODAY
    )
    const wrapper = await mountSuspended(BodyStepsWeekChart, {
      props: { week: lopsided, today: TODAY, lastWeekTotal: null }
    })
    expect(wrapper.find('[data-test="steps-hit-icon-2026-10-04"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="steps-hit-2026-10-05"]').text()).toBe('Target met')
    expect(wrapper.find('[data-test="steps-hit-icon-2026-10-05"]').exists()).toBe(false)
  })
})
