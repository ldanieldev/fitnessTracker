import { describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ExerciseFilterSheet from '../../app/components/workout/ExerciseFilterSheet.vue'

const props = {
  open: true,
  muscles: [{ key: 'chest', name: 'Chest' }, { key: 'lats', name: 'Lats' }],
  equipment: [{ key: 'barbell', name: 'Barbell' }, { key: 'cable', name: 'Cable' }],
  filters: { muscles: [], equipment: [], difficulty: null, includeHidden: false }
}

// AppSheet teleports its body out of the mounted subtree, so query the attached document instead of wrapper.find.
function find(selector: string) {
  return new DOMWrapper(document.querySelector(selector))
}

describe('ExerciseFilterSheet', () => {
  it('applies the muscles picked on the body map', async () => {
    const wrapper = await mountSuspended(ExerciseFilterSheet, { attachTo: document.body, props })
    await flushPromises()
    await find('[data-test="muscle-chest"]').trigger('click')
    await find('[data-test="filter-apply"]').trigger('click')
    expect(wrapper.emitted('apply')![0]![0]).toMatchObject({ muscles: ['chest'] })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('applies equipment and difficulty together', async () => {
    const wrapper = await mountSuspended(ExerciseFilterSheet, { attachTo: document.body, props })
    await flushPromises()
    await find('[data-test="equipment-barbell"]').trigger('click')
    await find('[data-test="difficulty-beginner"]').trigger('click')
    await find('[data-test="filter-apply"]').trigger('click')
    expect(wrapper.emitted('apply')![0]![0]).toMatchObject({ equipment: ['barbell'], difficulty: 'beginner' })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('clears every filter at once', async () => {
    const wrapper = await mountSuspended(ExerciseFilterSheet, {
      attachTo: document.body,
      props: {
        ...props,
        filters: { muscles: ['chest'], equipment: ['cable'], difficulty: 'beginner', includeHidden: true }
      }
    })
    await flushPromises()
    await find('[data-test="filter-clear"]').trigger('click')
    await find('[data-test="filter-apply"]').trigger('click')
    const applied = wrapper.emitted('apply')![0]![0]
    expect(applied).toEqual({ muscles: [], equipment: [], difficulty: null, includeHidden: false })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('carries the show-hidden switch into the applied filters', async () => {
    const wrapper = await mountSuspended(ExerciseFilterSheet, { attachTo: document.body, props })
    await flushPromises()
    await find('[data-test="filter-hidden"]').trigger('click')
    await find('[data-test="filter-apply"]').trigger('click')
    expect(wrapper.emitted('apply')![0]![0]).toMatchObject({ includeHidden: true })
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
