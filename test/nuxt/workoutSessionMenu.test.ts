import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { readBody } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import WorkoutSessionMenu from '../../app/components/workout/WorkoutSessionMenu.vue'

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 4,
    name: 'Push Day',
    performedOn: '2026-09-18',
    startedAt: new Date('2026-09-18T11:58:55.000Z').toISOString(),
    endedAt: null,
    notes: null,
    routineDayId: null,
    deload: false,
    entries: [],
    ...overrides
  }
}

const patched = vi.fn()
registerEndpoint('/api/workouts/sessions/4', {
  method: 'PATCH',
  handler: async (event) => {
    const body = await readBody(event)
    patched(body)
    return { ...makeSession(), notes: body.notes }
  }
})

describe('WorkoutSessionMenu', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    patched.mockClear()
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

  it('opens the comment sheet with the saved notes and saves the trimmed text, or null when cleared', async () => {
    const wrapper = await mountSuspended(WorkoutSessionMenu, {
      props: { session: makeSession({ notes: 'old note' }) }
    })
    await pick(wrapper, 'Comment')
    expect(document.body.querySelector<HTMLTextAreaElement>('[data-test="session-comment-input"]')!.value).toBe(
      'old note'
    )
    typeComment('  felt strong  ')
    await nextTick()
    document.body.querySelector<HTMLElement>('[data-test="session-comment-save"]')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('update:session')).toHaveLength(1))
    expect(patched).toHaveBeenLastCalledWith({ notes: 'felt strong' })
    expect(wrapper.emitted('update:session')!.at(-1)![0]).toMatchObject({
      notes: 'felt strong'
    })

    await pick(wrapper, 'Comment')
    typeComment('   ')
    await nextTick()
    document.body.querySelector<HTMLElement>('[data-test="session-comment-save"]')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('update:session')).toHaveLength(2))
    expect(patched).toHaveBeenLastCalledWith({ notes: null })
    expect(wrapper.emitted('update:session')!.at(-1)![0]).toMatchObject({
      notes: null
    })
  })

  it('asks before deleting and emits delete only on confirm', async () => {
    const wrapper = await mountSuspended(WorkoutSessionMenu, {
      props: { session: makeSession() }
    })
    await pick(wrapper, 'Delete')
    expect(document.body.querySelector('[data-test="session-delete"]')).not.toBeNull()
    expect(wrapper.emitted('delete')).toBeUndefined()
    document.body.querySelector<HTMLElement>('[data-test="session-delete-confirm"]')!.click()
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('prepends extra items', async () => {
    const onTools = vi.fn()
    const wrapper = await mountSuspended(WorkoutSessionMenu, {
      props: {
        session: makeSession(),
        extraItems: [[{ label: 'Workout tools', onSelect: onTools }]]
      }
    })
    await wrapper.find('[data-test="session-menu"]').trigger('click')
    await nextTick()
    const first = document.body.querySelector<HTMLElement>('[role="menuitem"]')!
    expect(first.textContent?.trim()).toBe('Workout tools')
    first.click()
    await nextTick()
    expect(onTools).toHaveBeenCalledOnce()
  })
})
