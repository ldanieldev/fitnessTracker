import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BodySparkline from '../../app/components/body/BodySparkline.vue'

describe('BodySparkline', () => {
  it('draws one path for two or more points and nothing otherwise', async () => {
    const two = await mountSuspended(BodySparkline, { props: { points: [{ date: '2026-09-01', value: 200 }, { date: '2026-09-08', value: 198 }] } })
    expect(two.find('[data-test="sparkline"] path').attributes('d')).toMatch(/^M/)
    const one = await mountSuspended(BodySparkline, { props: { points: [{ date: '2026-09-01', value: 200 }] } })
    expect(one.find('[data-test="sparkline"]').exists()).toBe(false)
  })
})
