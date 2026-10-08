import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ExerciseBodyMap from '../../app/components/workout/ExerciseBodyMap.vue'

const muscles = [
  { key: 'biceps', name: 'Biceps', bodyMapGroups: ['BICEPS'] },
  { key: 'chest', name: 'Chest', bodyMapGroups: ['CHEST'] },
  { key: 'lats', name: 'Lats', bodyMapGroups: ['LATS'] },
  { key: 'neck', name: 'Neck', bodyMapGroups: [] },
  { key: 'quadriceps', name: 'Quadriceps', bodyMapGroups: ['QUADS'] }
]
const available = ['chest', 'lats', 'quadriceps']

describe('ExerciseBodyMap', () => {
  it('marks selected muscles and leaves the rest unselected', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { muscles, selected: ['chest'], available } })
    expect(wrapper.find('[data-test="muscle-chest"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-test="muscle-lats"]').attributes('aria-pressed')).toBe('false')
  })

  it('emits toggle with the muscle key when a muscle is tapped', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { muscles, selected: [], available } })
    await wrapper.find('[data-test="muscle-chest"]').trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([['chest']])
  })

  it('disables muscles that are not available and emits nothing for them', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { muscles, selected: [], available: ['chest'] } })
    const lats = wrapper.find('[data-test="muscle-lats"]')
    expect(lats.attributes('disabled')).toBeDefined()
    await lats.trigger('click')
    expect(wrapper.emitted('toggle')).toBeUndefined()
  })

  it('offers neck in the name list even though it has no drawn surface', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { muscles, selected: [], available: ['neck'] } })
    await wrapper.find('[data-test="muscle-neck"]').trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([['neck']])
  })

  it('switches between front and back views', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { muscles, selected: [], available } })
    expect(wrapper.find('[data-test="body-map-svg"]').attributes('data-view')).toBe('front')
    await wrapper.find('[data-test="body-view-back"]').trigger('click')
    expect(wrapper.find('[data-test="body-map-svg"]').attributes('data-view')).toBe('back')
  })

  it('activates a surface with the keyboard', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { muscles, selected: [], available } })
    await wrapper.find('[data-test="muscle-surface-chest"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('toggle')).toEqual([['chest']])
  })

  it('does not activate an unavailable surface with the keyboard', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, { props: { muscles, selected: [], available: ['chest'] } })
    await wrapper.find('[data-test="muscle-surface-biceps"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('toggle')).toBeUndefined()
  })

  it('draws surfaces and chips from the muscles it is given, not the seed map', async () => {
    const wrapper = await mountSuspended(ExerciseBodyMap, {
      props: {
        muscles: [{ key: 'chest', name: 'Pecs', bodyMapGroups: ['CHEST', 'OBLIQUES'] }],
        selected: [],
        available: ['chest']
      }
    })
    // The front diagram has two CHEST and two OBLIQUES paths (app/assets/bodyMap.json).
    expect(wrapper.findAll('[data-test="muscle-surface-chest"]')).toHaveLength(4)
    expect(wrapper.findAll('[data-test^="muscle-surface-"]')).toHaveLength(4)
    expect(wrapper.find('[data-test="muscle-surface-chest"]').attributes('aria-label')).toBe('Pecs')
    expect(wrapper.findAll('button[data-test^="muscle-"]')).toHaveLength(1)
    expect(wrapper.find('[data-test="muscle-chest"]').text()).toBe('Pecs')
  })
})
