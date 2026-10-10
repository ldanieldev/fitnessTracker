import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody, setResponseStatus } from 'h3'
import { useToday } from '../../app/composables/useToday'
import BodyStepsSheet from '../../app/components/body/BodyStepsSheet.vue'

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))

const q = <T extends Element>(sel: string) => document.querySelector(sel) as T | null

function type(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('BodyStepsSheet', () => {
  it('opens on today, blocks Save until a whole count is typed, and PUTs the day', async () => {
    useToday().value = '2026-10-07'
    let received: { path: string; body: unknown } | null = null
    registerEndpoint('/api/body/steps/days/2026-10-07', {
      method: 'PUT',
      handler: async (event) => {
        received = { path: event.path, body: await readBody(event) }
        return { date: '2026-10-07', steps: 8229 }
      }
    })
    const wrapper = await mountSuspended(BodyStepsSheet, {
      attachTo: document.body,
      props: { open: true, date: null, known: {} }
    })
    await flushPromises()
    expect(document.body.textContent).toContain('Log steps')
    const date = q<HTMLInputElement>('input[data-test="steps-date"]')!
    expect(date.value).toBe('2026-10-07')
    expect(date.getAttribute('max')).toBe('2026-10-07')
    expect(q('[data-test="steps-delete"]')).toBeNull()
    const save = q<HTMLButtonElement>('[data-test="steps-save"]')!
    expect(save.disabled).toBe(true)

    type(q<HTMLInputElement>('input[data-test="steps-value"]')!, '8229')
    await flushPromises()
    expect(save.disabled).toBe(false)
    save.click()
    await vi.waitFor(() => expect(received).not.toBeNull())
    expect(received!.body).toEqual({ steps: 8229 })
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('prefills a known day, offers Delete behind a confirm, and follows the date field', async () => {
    useToday().value = '2026-10-07'
    let deleted = false
    registerEndpoint('/api/body/steps/days/2026-10-05', {
      method: 'DELETE',
      handler: () => {
        deleted = true
        return { ok: true }
      }
    })
    const wrapper = await mountSuspended(BodyStepsSheet, {
      attachTo: document.body,
      props: { open: true, date: '2026-10-05', known: { '2026-10-05': 6500 } }
    })
    await flushPromises()
    expect(document.body.textContent).toContain('Edit steps')
    expect(q<HTMLInputElement>('input[data-test="steps-value"]')!.value).toBe('6500')

    type(q<HTMLInputElement>('input[data-test="steps-date"]')!, '2026-10-06')
    await flushPromises()
    expect(q<HTMLInputElement>('input[data-test="steps-value"]')!.value).toBe('')
    expect(q('[data-test="steps-delete"]')).toBeNull()

    type(q<HTMLInputElement>('input[data-test="steps-date"]')!, '2026-10-05')
    await flushPromises()
    q<HTMLButtonElement>('[data-test="steps-delete"]')!.click()
    await flushPromises()
    q<HTMLButtonElement>('[data-test="steps-delete-confirm"]')!.click()
    await vi.waitFor(() => expect(deleted).toBe(true))
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('keeps Save disabled for a fraction, a negative, over 200,000, or a future date', async () => {
    useToday().value = '2026-10-07'
    const wrapper = await mountSuspended(BodyStepsSheet, {
      attachTo: document.body,
      props: { open: true, date: null, known: {} }
    })
    await flushPromises()
    const save = q<HTMLButtonElement>('[data-test="steps-save"]')!
    for (const bad of ['1.5', '-1', '200001']) {
      type(q<HTMLInputElement>('input[data-test="steps-value"]')!, bad)
      await flushPromises()
      expect(save.disabled).toBe(true)
    }
    type(q<HTMLInputElement>('input[data-test="steps-date"]')!, '2026-10-08')
    await flushPromises()
    type(q<HTMLInputElement>('input[data-test="steps-value"]')!, '5000')
    await flushPromises()
    expect(save.disabled).toBe(true)
    type(q<HTMLInputElement>('input[data-test="steps-date"]')!, '2026-10-07')
    await flushPromises()
    type(q<HTMLInputElement>('input[data-test="steps-value"]')!, '5000')
    await flushPromises()
    expect(save.disabled).toBe(false)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('shows an error toast and stays open when the save fails', async () => {
    useToday().value = '2026-10-07'
    registerEndpoint('/api/body/steps/days/2026-10-07', {
      method: 'PUT',
      handler: (event) => {
        setResponseStatus(event, 500)
        return { statusMessage: 'boom' }
      }
    })
    const wrapper = await mountSuspended(BodyStepsSheet, {
      attachTo: document.body,
      props: { open: true, date: null, known: {} }
    })
    await flushPromises()
    type(q<HTMLInputElement>('input[data-test="steps-value"]')!, '8229')
    await flushPromises()
    q<HTMLButtonElement>('[data-test="steps-save"]')!.click()
    await vi.waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Save failed', color: 'error' }))
    )
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(document.body.textContent).toContain('Log steps')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('looks up a day outside the known weeks, prefills it and offers Delete', async () => {
    useToday().value = '2026-10-07'
    registerEndpoint('/api/body/steps/days/2026-08-03', {
      method: 'GET',
      handler: () => ({ day: { date: '2026-08-03', steps: 6100 } })
    })
    registerEndpoint('/api/body/steps/days/2026-08-04', { method: 'GET', handler: () => ({ day: null }) })
    const wrapper = await mountSuspended(BodyStepsSheet, {
      attachTo: document.body,
      props: { open: true, date: null, known: {} }
    })
    await flushPromises()

    type(q<HTMLInputElement>('input[data-test="steps-date"]')!, '2026-08-03')
    await vi.waitFor(() => expect(q<HTMLInputElement>('input[data-test="steps-value"]')!.value).toBe('6100'))
    expect(document.body.textContent).toContain('Edit steps')
    expect(q('[data-test="steps-delete"]')).not.toBeNull()

    type(q<HTMLInputElement>('input[data-test="steps-date"]')!, '2026-08-04')
    await flushPromises()
    expect(q<HTMLInputElement>('input[data-test="steps-value"]')!.value).toBe('')
    expect(q('[data-test="steps-delete"]')).toBeNull()
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('focuses the steps field on open and saves when the form is submitted (Enter)', async () => {
    useToday().value = '2026-10-07'
    let received: unknown = null
    registerEndpoint('/api/body/steps/days/2026-10-07', {
      method: 'PUT',
      handler: async (event) => {
        received = await readBody(event)
        return { date: '2026-10-07', steps: 6400 }
      }
    })
    const wrapper = await mountSuspended(BodyStepsSheet, {
      attachTo: document.body,
      props: { open: true, date: null, known: {} }
    })
    await vi.waitFor(() => expect(document.activeElement).toBe(q('input[data-test="steps-value"]')))
    const input = q<HTMLInputElement>('input[data-test="steps-value"]')!

    const form = q<HTMLFormElement>('form[data-test="steps-form"]')!
    expect(q<HTMLButtonElement>('[data-test="steps-save"]')!.type).toBe('submit')
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()
    expect(received).toBeNull()

    type(input, '6400')
    await flushPromises()
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(received).toEqual({ steps: 6400 }))
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
