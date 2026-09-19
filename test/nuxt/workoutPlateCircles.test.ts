import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutPlateCircles from '../../app/components/workout/WorkoutPlateCircles.vue'

const rack = [55, 45, 35, 25, 10, 5, 2.5]

function lastModel(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  const events = wrapper.emitted('update:modelValue')!
  return events[events.length - 1]![0]
}

describe('WorkoutPlateCircles', () => {
  it('derives the per-side counts from the weight, largest first', async () => {
    const wrapper = await mountSuspended(WorkoutPlateCircles, { props: { modelValue: 190, bar: 45, sizes: rack } })
    expect(wrapper.find('[data-test="plate-count-55"]').text()).toBe('1')
    expect(wrapper.find('[data-test="plate-count-10"]').text()).toBe('1')
    expect(wrapper.find('[data-test="plate-count-5"]').text()).toBe('1')
    expect(wrapper.find('[data-test="plate-count-2.5"]').text()).toBe('1')
    expect(wrapper.find('[data-test="plate-count-45"]').exists()).toBe(false)
  })

  it('adds a pair on tap and removes one on the count badge', async () => {
    const wrapper = await mountSuspended(WorkoutPlateCircles, { props: { modelValue: 135, bar: 45, sizes: rack } })
    await wrapper.find('[data-test="plate-25"]').trigger('click')
    expect(lastModel(wrapper)).toBe(185)
    await wrapper.setProps({ modelValue: 185 })
    await wrapper.find('[data-test="plate-count-25"]').trigger('click')
    expect(lastModel(wrapper)).toBe(135)
  })

  it('keeps the plates that were tapped instead of re-deriving them', async () => {
    const wrapper = await mountSuspended(WorkoutPlateCircles, { props: { modelValue: 45, bar: 45, sizes: rack } })
    await wrapper.find('[data-test="plate-35"]').trigger('click')
    expect(lastModel(wrapper)).toBe(115)
    await wrapper.find('[data-test="plate-35"]').trigger('click')
    expect(lastModel(wrapper)).toBe(185)
    await wrapper.setProps({ modelValue: 185 })
    expect(wrapper.find('[data-test="plate-count-35"]').text()).toBe('2')
    expect(wrapper.find('[data-test="plate-count-45"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="plate-count-25"]').exists()).toBe(false)
  })

  it('re-derives when the weight changes from outside', async () => {
    const wrapper = await mountSuspended(WorkoutPlateCircles, { props: { modelValue: 45, bar: 45, sizes: rack } })
    await wrapper.find('[data-test="plate-35"]').trigger('click')
    await wrapper.find('[data-test="plate-35"]').trigger('click')
    await wrapper.setProps({ modelValue: 185 })
    await wrapper.setProps({ modelValue: 135 })
    expect(wrapper.find('[data-test="plate-count-45"]').text()).toBe('1')
    expect(wrapper.find('[data-test="plate-count-35"]').exists()).toBe(false)
  })

  it('shows every size of the exercise\'s set and nothing else', async () => {
    const wrapper = await mountSuspended(WorkoutPlateCircles, { props: { modelValue: 45, bar: 45, sizes: [45, 25] } })
    expect(wrapper.findAll('[data-test^="plate-"]').filter((n) => !n.attributes('data-test')!.startsWith('plate-count')).map((n) => n.attributes('data-test'))).toEqual(['plate-45', 'plate-25'])
  })

  it('explains an unloadable weight and a weight below the bar', async () => {
    const cant = await mountSuspended(WorkoutPlateCircles, { props: { modelValue: 227, bar: 45, sizes: rack } })
    expect(cant.find('[data-test="plates-cant-load"]').text()).toContain('227')
    expect(cant.findAll('[data-test^="plate-count-"]')).toHaveLength(0)
    const low = await mountSuspended(WorkoutPlateCircles, { props: { modelValue: 30, bar: 45, sizes: rack } })
    expect(low.find('[data-test="plates-below-bar"]').text()).toContain('45')
  })

  it('names the bar in the caption', async () => {
    const wrapper = await mountSuspended(WorkoutPlateCircles, { props: { modelValue: null, bar: 45, sizes: rack } })
    expect(wrapper.find('[data-test="plates-caption"]').text()).toContain('Bar: 45 lb')
  })
})
