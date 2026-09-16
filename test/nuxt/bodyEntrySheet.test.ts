import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { useToday } from '../../app/composables/useToday'
import BodyEntrySheet from '../../app/components/body/BodyEntrySheet.vue'

const type = { id: 1, key: 'bodyweight', name: 'Bodyweight', unit: 'lbs', precision: 1, direction: 'neutral' as const, builtIn: true, hidden: false, sortOrder: null }

describe('BodyEntrySheet', () => {
  it('defaults the date to today, disables Save until a value is typed, and posts value + local day + instant', async () => {
    useToday().value = '2026-09-16'
    let received: Record<string, unknown> | null = null
    registerEndpoint('/api/body/entries', {
      method: 'POST',
      handler: async (event) => {
        received = await readBody(event)
        return { id: 9, typeId: 1, value: 197, measuredAt: '2026-09-16T08:25:00.000Z', measuredOn: '2026-09-16' }
      }
    })
    const wrapper = await mountSuspended(BodyEntrySheet, { attachTo: document.body, props: { open: true, type, entry: null } })
    await flushPromises()
    const date = document.querySelector('input[data-test="entry-date"]') as HTMLInputElement
    expect(date.value).toBe('2026-09-16')
    const save = document.querySelector('[data-test="entry-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(true)

    const value = document.querySelector('input[data-test="entry-value"]') as HTMLInputElement
    value.value = '197'
    value.dispatchEvent(new Event('input', { bubbles: true }))
    const time = document.querySelector('input[data-test="entry-time"]') as HTMLInputElement
    time.value = '08:25'
    time.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(save.disabled).toBe(false)
    save.click()
    await vi.waitFor(() => expect(received).not.toBeNull())

    expect(received!.typeId).toBe(1)
    expect(received!.value).toBe(197)
    expect(received!.measuredOn).toBe('2026-09-16')
    expect(new Date(received!.measuredAt as string).toISOString()).toBe(new Date('2026-09-16T08:25:00').toISOString())
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('prefills an existing entry and exposes delete behind a confirm', async () => {
    const wrapper = await mountSuspended(BodyEntrySheet, {
      attachTo: document.body,
      props: { open: true, type, entry: { id: 4, typeId: 1, value: 198.8, measuredAt: '2026-03-03T09:51:00.000Z', measuredOn: '2026-03-03' } }
    })
    await flushPromises()
    expect((document.querySelector('input[data-test="entry-value"]') as HTMLInputElement).value).toBe('198.8')
    expect((document.querySelector('input[data-test="entry-date"]') as HTMLInputElement).value).toBe('2026-03-03')
    expect(document.querySelector('[data-test="entry-delete-confirm"]')).toBeNull()
    ;(document.querySelector('[data-test="entry-delete"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(document.querySelector('[data-test="entry-delete-confirm"]')).not.toBeNull()
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
