import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BodyStepsHistory from '../../app/components/body/BodyStepsHistory.vue'
import { summarizeWeek } from '../../shared/utils/steps'

const eight = [{ dailyTarget: 8000, effectiveFrom: '2026-01-01' }]
const PAST = '2026-12-01'
const met = summarizeWeek('2026-09-27', [{ date: '2026-09-27', steps: 9000 }], eight, PAST)
const missed = summarizeWeek('2026-09-20', [{ date: '2026-09-20', steps: 3000 }], eight, PAST)
const empty = summarizeWeek('2026-09-13', [], eight, PAST)
const noTarget = summarizeWeek('2026-09-06', [{ date: '2026-09-06', steps: 3000 }], [], PAST)

describe('BodyStepsHistory', () => {
  it('shows range, average, total, days logged and a met / missed / not-tracked badge', async () => {
    const wrapper = await mountSuspended(BodyStepsHistory, { props: { weeks: [met, missed, empty, noTarget] } })
    const row = wrapper.find('[data-test="steps-history-2026-09-27"]')
    expect(row.text()).toContain('Sep 27 – Oct 3')
    expect(row.text()).toContain('9,000/day')
    expect(row.text()).toContain('1/7')
    expect(wrapper.find('[data-test="steps-badge-2026-09-27"]').text()).toBe('Met')
    expect(wrapper.find('[data-test="steps-badge-2026-09-20"]').text()).toBe('Missed')
    expect(wrapper.find('[data-test="steps-badge-2026-09-13"]').text()).toBe('Not tracked')
    expect(wrapper.find('[data-test="steps-badge-2026-09-06"]').exists()).toBe(false)
  })
})
