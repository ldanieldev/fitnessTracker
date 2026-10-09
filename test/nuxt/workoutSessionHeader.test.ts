import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutSessionHeader from '../../app/components/workout/WorkoutSessionHeader.vue'

const NOW = new Date('2026-09-18T12:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 4,
    name: 'Push Day',
    performedOn: '2026-09-18',
    startedAt: new Date(NOW.getTime() - 65_000).toISOString(),
    endedAt: null,
    notes: null,
    routineDayId: null,
    deload: false,
    entries: [],
    ...overrides
  }
}

describe('WorkoutSessionHeader', () => {
  it('shows the name and the elapsed time as m:ss under an hour', async () => {
    const wrapper = await mountSuspended(WorkoutSessionHeader, { props: { session: makeSession() } })
    expect((wrapper.find('[data-test="session-name"]').element as HTMLInputElement).value).toBe('Push Day')
    expect(wrapper.find('[data-test="session-elapsed"]').text()).toBe('1:05')
  })

  it('shows h:mm:ss past an hour and stops at the end of a finished session', async () => {
    const startedAt = new Date('2026-09-18T10:00:00.000Z').toISOString()
    const session = makeSession({ startedAt, endedAt: new Date('2026-09-18T11:01:40.000Z').toISOString() })
    const wrapper = await mountSuspended(WorkoutSessionHeader, { props: { session } })
    expect(wrapper.find('[data-test="session-elapsed"]').text()).toBe('1:01:40')
  })

  it('emits rename on blur only when the name changed', async () => {
    const wrapper = await mountSuspended(WorkoutSessionHeader, { props: { session: makeSession() } })
    const input = wrapper.find('[data-test="session-name"]')
    await input.trigger('blur')
    expect(wrapper.emitted('rename')).toBeUndefined()

    await input.setValue('Pull Day')
    await input.trigger('blur')
    expect(wrapper.emitted('rename')).toEqual([['Pull Day']])
  })

  it('emits rename with null when the name is cleared', async () => {
    const wrapper = await mountSuspended(WorkoutSessionHeader, { props: { session: makeSession() } })
    const input = wrapper.find('[data-test="session-name"]')
    await input.setValue('   ')
    await input.trigger('blur')
    expect(wrapper.emitted('rename')).toEqual([[null]])
  })
})

describe('WorkoutSessionHeader sheets', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  async function pick(wrapper: Awaited<ReturnType<typeof mountSuspended>>, label: string) {
    await wrapper.find('[data-test="session-menu"]').trigger('click')
    await nextTick()
    const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (el) => el.textContent?.trim() === label
    )!
    item.click()
    await nextTick()
    await nextTick()
  }

  function typeComment(value: string) {
    const input = document.body.querySelector<HTMLTextAreaElement>('[data-test="session-comment-input"]')!
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  it('opens the comment sheet with the saved notes and emits the trimmed text, or null when cleared', async () => {
    const wrapper = await mountSuspended(WorkoutSessionHeader, {
      props: { session: makeSession({ notes: 'old note' }) }
    })
    await pick(wrapper, 'Comment')
    expect(document.body.querySelector<HTMLTextAreaElement>('[data-test="session-comment-input"]')!.value).toBe(
      'old note'
    )
    typeComment('  felt strong  ')
    await nextTick()
    document.body.querySelector<HTMLElement>('[data-test="session-comment-save"]')!.click()
    expect(wrapper.emitted('comment')).toEqual([['felt strong']])

    await pick(wrapper, 'Comment')
    typeComment('   ')
    await nextTick()
    document.body.querySelector<HTMLElement>('[data-test="session-comment-save"]')!.click()
    expect(wrapper.emitted('comment')!.at(-1)).toEqual([null])
  })

  it('asks before deleting and emits delete only on confirm', async () => {
    const wrapper = await mountSuspended(WorkoutSessionHeader, { props: { session: makeSession() } })
    await pick(wrapper, 'Delete')
    expect(document.body.querySelector('[data-test="session-delete"]')).not.toBeNull()
    expect(wrapper.emitted('delete')).toBeUndefined()
    document.body.querySelector<HTMLElement>('[data-test="session-delete-confirm"]')!.click()
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })
})
