import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import AppDayNoteSheet from '../../app/components/AppDayNoteSheet.vue'

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))

const q = <T extends Element>(sel: string) => document.querySelector(sel) as T | null

function type(input: HTMLTextAreaElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('AppDayNoteSheet', () => {
  it('shows the day, prefills the note, trims on save and emits the saved note', async () => {
    let received: unknown = null
    registerEndpoint('/api/days/2026-10-11/note', {
      method: 'PUT',
      handler: async (event) => {
        received = await readBody(event)
        return { date: '2026-10-11', note: 'Event day' }
      }
    })
    const wrapper = await mountSuspended(AppDayNoteSheet, {
      attachTo: document.body,
      props: { open: true, date: '2026-10-11', note: 'old' }
    })
    await flushPromises()
    expect(document.body.textContent).toContain('Sun, Oct 11, 2026')
    const input = q<HTMLTextAreaElement>('[data-test="day-notes-input"]')!
    expect(input.value).toBe('old')
    type(input, '  Event day  ')
    await flushPromises()
    q<HTMLButtonElement>('[data-test="day-notes-save"]')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toEqual([['Event day']]))
    expect(received).toEqual({ note: 'Event day' })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('sends null for a blank note', async () => {
    let received: unknown = null
    registerEndpoint('/api/days/2026-10-12/note', {
      method: 'PUT',
      handler: async (event) => {
        received = await readBody(event)
        return { date: '2026-10-12', note: null }
      }
    })
    const wrapper = await mountSuspended(AppDayNoteSheet, {
      attachTo: document.body,
      props: { open: true, date: '2026-10-12', note: 'gone soon' }
    })
    await flushPromises()
    type(q<HTMLTextAreaElement>('[data-test="day-notes-input"]')!, '   ')
    await flushPromises()
    q<HTMLButtonElement>('[data-test="day-notes-save"]')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toEqual([[null]]))
    expect(received).toEqual({ note: null })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('keeps the sheet open and toasts when the save fails', async () => {
    toastAdd.mockReset()
    registerEndpoint('/api/days/2026-10-13/note', {
      method: 'PUT',
      handler: () => {
        throw createError({ statusCode: 500, statusMessage: 'boom' })
      }
    })
    const wrapper = await mountSuspended(AppDayNoteSheet, {
      attachTo: document.body,
      props: { open: true, date: '2026-10-13', note: null }
    })
    await flushPromises()
    type(q<HTMLTextAreaElement>('[data-test="day-notes-input"]')!, 'x')
    await flushPromises()
    q<HTMLButtonElement>('[data-test="day-notes-save"]')!.click()
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalled())
    expect(toastAdd.mock.calls[0]![0]).toMatchObject({ title: 'Save failed', color: 'error' })
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
