import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutToolsSetCalc from '../../app/components/workout/WorkoutToolsSetCalc.vue'

const barbell = { exerciseId: 1, loadStyle: 'barbell' as const, bar: 45, sizes: [45, 35, 25, 10, 5, 2.5], increment: 5 }
const plain = { exerciseId: 2, loadStyle: 'plain' as const, bar: null, sizes: null, increment: 2.5 }

describe('WorkoutToolsSetCalc', () => {
  it('rounds 85% to a loadable barbell weight with plates', async () => {
    const wrapper = await mountSuspended(WorkoutToolsSetCalc, {
      props: { oneRm: 262, pending: false, context: barbell }
    })
    expect(wrapper.find('[data-test="set-calc-raw"]').text()).toContain('222.7')
    expect(wrapper.find('[data-test="set-calc-loadable"]').text()).toContain('225')
    expect(wrapper.find('[data-test="set-calc-plates"]').text()).toBe('Each side: 45 · 45')
  })

  it('uses the quick buttons and emits the weight to load', async () => {
    const wrapper = await mountSuspended(WorkoutToolsSetCalc, {
      props: { oneRm: 262, pending: false, context: barbell }
    })
    await wrapper.find('[data-test="set-calc-quick-75"]').trigger('click')
    expect(wrapper.find('[data-test="set-calc-loadable"]').text()).toContain('195')
    await wrapper.find('[data-test="set-calc-use"]').trigger('click')
    expect(wrapper.emitted('use')).toEqual([[195]])
  })

  it('rounds a plain exercise to its increment', async () => {
    const wrapper = await mountSuspended(WorkoutToolsSetCalc, { props: { oneRm: 100, pending: false, context: plain } })
    await wrapper.find('[data-test="set-calc-quick-65"]').trigger('click')
    expect(wrapper.find('[data-test="set-calc-loadable"]').text()).toContain('65')
    expect(wrapper.find('[data-test="set-calc-plates"]').exists()).toBe(false)
  })

  it('shows a skeleton while the 1RM loads and a hint when there is none', async () => {
    const loading = await mountSuspended(WorkoutToolsSetCalc, {
      props: { oneRm: null, pending: true, context: barbell }
    })
    expect(loading.find('[data-test="set-calc-skeleton"]').exists()).toBe(true)
    const none = await mountSuspended(WorkoutToolsSetCalc, { props: { oneRm: null, pending: false, context: barbell } })
    expect(none.find('[data-test="set-calc-empty"]').exists()).toBe(true)
  })

  it('treats 0 % as no input instead of the bare bar', async () => {
    const wrapper = await mountSuspended(WorkoutToolsSetCalc, {
      props: { oneRm: 262, pending: false, context: barbell }
    })
    await wrapper.find('[data-test="set-calc-percent"]').setValue('0')
    expect(wrapper.find('[data-test="set-calc-raw"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="set-calc-loadable"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="set-calc-plates"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="set-calc-use"]').exists()).toBe(false)
  })
})
