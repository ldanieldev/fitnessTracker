import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutSessionTimesSheet from '../../app/components/workout/WorkoutSessionTimesSheet.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

async function mountSheet() {
  const wrapper = await mountSuspended(WorkoutSessionTimesSheet, {
    attachTo: document.body,
    props: { open: true, startedAt: new Date('2026-09-18T17:00:00').toISOString(), endedAt: null }
  })
  await flushPromises()
  return wrapper
}

function setInput(selector: string, value: string) {
  const input = document.querySelector(selector) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('WorkoutSessionTimesSheet', () => {
  it('derives performedOn from the local calendar date of the start input', async () => {
    const wrapper = await mountSheet()
    setInput('input[data-test="session-start-input"]', '2026-01-02T18:30')
    await flushPromises()
    ;(document.querySelector('[data-test="session-times-save"]') as HTMLButtonElement).click()
    await flushPromises()

    const saved = wrapper.emitted('save')![0]![0] as { startedAt: string; endedAt: string | null; performedOn: string }
    expect(saved.performedOn).toBe('2026-01-02')
    expect(saved.startedAt).toBe(new Date('2026-01-02T18:30').toISOString())
    expect(saved.endedAt).toBeNull()
    wrapper.unmount()
  })

  it('prefills both inputs from the session and sends the ended time when one is set', async () => {
    const wrapper = await mountSheet()
    expect((document.querySelector('input[data-test="session-start-input"]') as HTMLInputElement).value).toBe(
      '2026-09-18T17:00'
    )
    setInput('input[data-test="session-end-input"]', '2026-09-18T18:15')
    await flushPromises()
    ;(document.querySelector('[data-test="session-times-save"]') as HTMLButtonElement).click()
    await flushPromises()

    const saved = wrapper.emitted('save')![0]![0] as { endedAt: string | null; performedOn: string }
    expect(saved.endedAt).toBe(new Date('2026-09-18T18:15').toISOString())
    expect(saved.performedOn).toBe('2026-09-18')
    wrapper.unmount()
  })
})
