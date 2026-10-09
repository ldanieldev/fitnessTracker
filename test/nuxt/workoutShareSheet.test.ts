import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutShareSheet from '../../app/components/workout/WorkoutShareSheet.vue'

describe('WorkoutShareSheet', () => {
  it('shows the text read-only when open', async () => {
    const wrapper = await mountSuspended(WorkoutShareSheet, {
      props: { open: true, text: 'Push A\n  185 lb × 8' },
      attachTo: document.body
    })
    const area = document.querySelector<HTMLTextAreaElement>(
      '[data-test="share-text"] textarea, textarea[data-test="share-text"]'
    )!
    expect(area.value).toBe('Push A\n  185 lb × 8')
    expect(area.readOnly).toBe(true)
    wrapper.unmount()
  })
})
