import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutProgramWhenSheet from '../../app/components/workout/WorkoutProgramWhenSheet.vue'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('WorkoutProgramWhenSheet', () => {
  it('labels both choices and emits the pick', async () => {
    const wrapper = await mountSuspended(WorkoutProgramWhenSheet, {
      attachTo: document.body,
      props: { open: true, title: 'Start BLS', week: 3, today: '2026-10-01' }
    })
    await flushPromises()
    const now = document.querySelector('[data-test="when-now"]')!
    const next = document.querySelector('[data-test="when-next"]')!
    expect(now.textContent).toContain('Week 3 counts from today')
    expect(next.textContent).toContain('Week 3 begins Mon, Oct 5')
    ;(next as HTMLElement).click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('choose')?.[0]).toEqual(['next'])
    wrapper.unmount()
  })
})
