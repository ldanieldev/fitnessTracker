import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ExerciseBodyMap from '../../app/components/workout/ExerciseBodyMap.vue'

const available = ['chest', 'lats', 'quadriceps']

describe('ExerciseBodyMap', () => {
  it('marks selected muscles and leaves the rest unselected', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { selected: ['chest'], available } })
    expect(wrapper.find('[data-test="muscle-chest"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-test="muscle-lats"]').attributes('aria-pressed')).toBe('false')
  })

  it('emits toggle with the muscle key when a muscle is tapped', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { selected: [], available } })
    await wrapper.find('[data-test="muscle-chest"]').trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([['chest']])
  })

  it('disables muscles that are not available and emits nothing for them', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { selected: [], available: ['chest'] } })
    const lats = wrapper.find('[data-test="muscle-lats"]')
    expect(lats.attributes('disabled')).toBeDefined()
    await lats.trigger('click')
    expect(wrapper.emitted('toggle')).toBeUndefined()
  })

  it('offers neck in the name list even though it has no drawn surface', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { selected: [], available: ['neck'] } })
    await wrapper.find('[data-test="muscle-neck"]').trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([['neck']])
  })

  it('switches between front and back views', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { selected: [], available } })
    expect(wrapper.find('[data-test="body-map-svg"]').attributes('data-view')).toBe('front')
    await wrapper.find('[data-test="body-view-back"]').trigger('click')
    expect(wrapper.find('[data-test="body-map-svg"]').attributes('data-view')).toBe('back')
  })

  it('activates a surface with the keyboard', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { selected: [], available } })
    await wrapper.find('[data-test="muscle-surface-chest"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('toggle')).toEqual([['chest']])
  })

  it('does not activate an unavailable surface with the keyboard', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { selected: [], available: ['chest'] } })
    await wrapper.find('[data-test="muscle-surface-biceps"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('toggle')).toBeUndefined()
  })
})
