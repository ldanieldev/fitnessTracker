import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutToolsPlates from '../../app/components/workout/WorkoutToolsPlates.vue'

const sizes = [45, 35, 25, 10, 5, 2.5]

describe('WorkoutToolsPlates', () => {
  it('lists each side for a loadable target', async () => {
    const wrapper = await mountSuspended(WorkoutToolsPlates, {
      props: { target: 185, bar: 45, sizes, barEditable: false }
    })
    expect(wrapper.find('[data-test="plates-each-side"]').text()).toBe('Each side: 45 · 25')
    expect(wrapper.find('[data-test="plate-bar"]').exists()).toBe(true)
  })

  it('offers the loaded weight for the next set only when the caller can take it', async () => {
    const wrapper = await mountSuspended(WorkoutToolsPlates, {
      props: { target: 185, bar: 45, sizes, barEditable: false, canUse: true }
    })
    await wrapper.find('[data-test="plates-use"]').trigger('click')
    expect(wrapper.emitted('use')).toEqual([[185]])

    const noExercise = await mountSuspended(WorkoutToolsPlates, {
      props: { target: 185, bar: 45, sizes, barEditable: false, canUse: false }
    })
    expect(noExercise.find('[data-test="plates-use"]').exists()).toBe(false)
  })

  it('offers the nearest weights when the target cannot be loaded', async () => {
    const wrapper = await mountSuspended(WorkoutToolsPlates, {
      props: { target: 227, bar: 45, sizes, barEditable: false }
    })
    expect(wrapper.find('[data-test="plates-cant-load"]').text()).toContain('227')
    expect(wrapper.find('[data-test="plates-nearest-below"]').text()).toContain('225')
    await wrapper.find('[data-test="plates-nearest-above"]').trigger('click')
    expect(wrapper.emitted('update:target')![0]).toEqual([230])
  })

  it('says when the target is below the bar', async () => {
    const wrapper = await mountSuspended(WorkoutToolsPlates, {
      props: { target: 30, bar: 45, sizes, barEditable: false }
    })
    expect(wrapper.find('[data-test="plates-below-bar"]').text()).toContain('45')
  })

  it('explains that plates only apply to barbell exercises', async () => {
    const wrapper = await mountSuspended(WorkoutToolsPlates, {
      props: { target: 100, bar: null, sizes: null, barEditable: false }
    })
    expect(wrapper.find('[data-test="plates-not-barbell"]').exists()).toBe(true)
  })

  it('lets the bar be edited only when asked', async () => {
    const fixed = await mountSuspended(WorkoutToolsPlates, {
      props: { target: 135, bar: 45, sizes, barEditable: false }
    })
    expect(fixed.find('[data-test="tools-bar"]').exists()).toBe(false)
    const free = await mountSuspended(WorkoutToolsPlates, { props: { target: 135, bar: 45, sizes, barEditable: true } })
    expect(free.find('[data-test="tools-bar"]').exists()).toBe(true)
  })

  it('asks for the bar weight when the free bar is cleared', async () => {
    const wrapper = await mountSuspended(WorkoutToolsPlates, {
      props: { target: 135, bar: null, sizes, barEditable: true }
    })
    expect(wrapper.find('[data-test="plates-no-bar"]').text()).toBe('Enter the bar weight.')
    expect(wrapper.find('[data-test="plates-not-barbell"]').exists()).toBe(false)
  })
})
