import { describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutSupersetSheet from '../../app/components/workout/WorkoutSupersetSheet.vue'

const find = (selector: string) => new DOMWrapper(document.querySelector(selector))

describe('WorkoutSupersetSheet', () => {
  it('emits the picked ids and stays disabled until one is picked', async () => {
    const wrapper = await mountSuspended(WorkoutSupersetSheet, {
      attachTo: document.body,
      props: { open: true, options: [{ id: 2, name: 'Row' }, { id: 3, name: 'Curl' }] }
    })
    await flushPromises()
    expect(find('[data-test="superset-confirm"]').attributes('disabled')).toBeDefined()
    await find('[data-test="superset-option-3"]').trigger('click')
    await find('[data-test="superset-confirm"]').trigger('click')
    expect(wrapper.emitted('group')).toEqual([[[3]]])
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
