import { describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutPointerPrompt from '../../app/components/workout/WorkoutPointerPrompt.vue'

const find = (selector: string) => new DOMWrapper(document.querySelector(selector))

describe('WorkoutPointerPrompt', () => {
  it('names both days and emits the choice', async () => {
    const wrapper = await mountSuspended(WorkoutPointerPrompt, {
      attachTo: document.body,
      props: { open: true, dayName: 'Legs', dueName: 'Shoulders' }
    })
    await flushPromises()
    expect(find('[data-test="pointer-prompt-text"]').text()).toBe('You\'re starting Legs but Shoulders is next.')
    expect(find('[data-test="pointer-skip"]').text()).toBe('Skip Shoulders')
    await find('[data-test="pointer-keep"]').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['keep']])
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
