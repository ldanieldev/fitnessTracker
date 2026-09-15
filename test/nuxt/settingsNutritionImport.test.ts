import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import type { DOMWrapper } from '@vue/test-utils'
import SettingsNutritionImport from '../../app/components/settings/SettingsNutritionImport.vue'

const { toastAddMock } = vi.hoisted(() => ({ toastAddMock: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: toastAddMock }))

function setFiles(input: DOMWrapper<Element>) {
  Object.defineProperty(input.element, 'files', {
    value: [new File(['x'], 'a.txt', { type: 'text/plain' }), new File(['y'], 'b.txt', { type: 'text/plain' })]
  })
}

describe('SettingsNutritionImport', () => {
  afterEach(() => {
    toastAddMock.mockClear()
  })

  it('uploads files, polls the job status, and renders the summary and warnings', async () => {
    registerEndpoint('/api/nutrition/import/mymacros', { method: 'POST', handler: () => ({ jobId: 7 }) })
    const appendSpy = vi.spyOn(FormData.prototype, 'append')

    const statusSequence = [
      { id: 7, status: 'queued', fileCount: 2, result: null, error: null, createdAt: '2026-09-05T00:00:00Z' },
      {
        id: 7,
        status: 'done',
        fileCount: 2,
        result: {
          days: 2,
          entries: 29,
          entriesSkipped: 0,
          foodsCreated: 12,
          foodsReused: 0,
          containersCreated: 0,
          warnings: [{ date: '2026-09-05', code: 'oz_as_fluid', message: 'Silk Vanilla Almond Milk imported as fl oz' }],
          failedFiles: []
        },
        error: null,
        createdAt: '2026-09-05T00:00:00Z'
      }
    ]
    registerEndpoint('/api/nutrition/import/mymacros/7', () => statusSequence.shift())

    const wrapper = await mountSuspended(SettingsNutritionImport)

    const input = wrapper.find('[data-test="import-files"]')
    setFiles(input)
    await input.trigger('change')

    vi.useFakeTimers()
    await wrapper.find('[data-test="import-submit"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-test="import-status"]').text()).toContain('queued')
    expect(wrapper.find('[data-test="import-submit"]').attributes('disabled')).toBeDefined()
    expect(appendSpy.mock.calls.map((call) => [call[0], (call[1] as File).name])).toEqual([
      ['files', 'a.txt'],
      ['files', 'b.txt']
    ])
    appendSpy.mockRestore()

    await vi.advanceTimersByTimeAsync(2000)

    expect(wrapper.find('[data-test="import-status"]').text()).toContain('queued')
    expect(wrapper.find('[data-test="import-submit"]').attributes('disabled')).toBeDefined()

    await vi.advanceTimersByTimeAsync(2000)
    vi.useRealTimers()

    await vi.waitFor(() => {
      expect(wrapper.find('[data-test="import-status"]').text()).toContain('done')
    })

    expect(wrapper.find('[data-test="import-summary"]').text()).toContain('29 entries')
    expect(wrapper.find('[data-test="import-summary"]').text()).toContain('2 days')
    expect(wrapper.find('[data-test="import-summary"]').text()).toContain('12 foods created, 0 reused')

    const warnings = wrapper.findAll('[data-test="import-warning"]')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.text()).toBe('2026-09-05 — Silk Vanilla Almond Milk imported as fl oz')

    expect(wrapper.find('[data-test="import-submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('imported')).toHaveLength(1)
  })

  it('renders failedFiles as alerts', async () => {
    registerEndpoint('/api/nutrition/import/mymacros', { method: 'POST', handler: () => ({ jobId: 9 }) })
    registerEndpoint('/api/nutrition/import/mymacros/9', () => ({
      id: 9,
      status: 'done',
      fileCount: 1,
      result: {
        days: 0,
        entries: 0,
        entriesSkipped: 0,
        foodsCreated: 0,
        foodsReused: 0,
        containersCreated: 0,
        warnings: [],
        failedFiles: [{ fileName: 'bad.txt', error: 'not a My Macros+ export' }]
      },
      error: null,
      createdAt: '2026-09-05T00:00:00Z'
    }))

    const wrapper = await mountSuspended(SettingsNutritionImport)
    const input = wrapper.find('[data-test="import-files"]')
    setFiles(input)
    await input.trigger('change')

    vi.useFakeTimers()
    await wrapper.find('[data-test="import-submit"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)
    vi.useRealTimers()

    await vi.waitFor(() => {
      expect(wrapper.find('[data-test="import-failed-file"]').exists()).toBe(true)
    })
    expect(wrapper.find('[data-test="import-failed-file"]').text()).toContain('bad.txt')
    expect(wrapper.find('[data-test="import-failed-file"]').text()).toContain('not a My Macros+ export')
  })

  it('stops polling after unmount: an in-flight status response does not reschedule', async () => {
    registerEndpoint('/api/nutrition/import/mymacros', { method: 'POST', handler: () => ({ jobId: 11 }) })

    let statusCalls = 0
    let resolveStatus: (value: unknown) => void = () => {}
    registerEndpoint('/api/nutrition/import/mymacros/11', () => {
      statusCalls++
      return new Promise((resolve) => {
        resolveStatus = resolve
      })
    })

    const wrapper = await mountSuspended(SettingsNutritionImport)
    const input = wrapper.find('[data-test="import-files"]')
    setFiles(input)
    await input.trigger('change')

    vi.useFakeTimers()
    await wrapper.find('[data-test="import-submit"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)
    vi.useRealTimers()

    await vi.waitFor(() => expect(statusCalls).toBe(1))

    wrapper.unmount()
    resolveStatus({
      id: 11,
      status: 'done',
      fileCount: 2,
      result: {
        days: 1,
        entries: 1,
        entriesSkipped: 0,
        foodsCreated: 1,
        foodsReused: 0,
        containersCreated: 0,
        warnings: [],
        failedFiles: []
      },
      error: null,
      createdAt: '2026-09-05T00:00:00Z'
    })
    await flushPromises()

    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(2000)
    vi.useRealTimers()
    await flushPromises()

    expect(statusCalls).toBe(1)
    expect(wrapper.emitted('imported')).toBeUndefined()
  })

  it('shows a toast with the job id when the upload is rejected with 503', async () => {
    registerEndpoint('/api/nutrition/import/mymacros', {
      method: 'POST',
      handler: () => {
        throw createError({
          statusCode: 503,
          statusMessage: 'Import job runner unreachable; the job was marked failed',
          data: { jobId: 42 }
        })
      }
    })

    const wrapper = await mountSuspended(SettingsNutritionImport)
    const input = wrapper.find('[data-test="import-files"]')
    setFiles(input)
    await input.trigger('change')
    await wrapper.find('[data-test="import-submit"]').trigger('click')
    await flushPromises()

    expect(toastAddMock).toHaveBeenCalledTimes(1)
    const call = toastAddMock.mock.calls[0]![0] as { title: string, description: string }
    expect(call.description).toContain('42')
    expect(wrapper.find('[data-test="import-submit"]').attributes('disabled')).toBeUndefined()
  })
})
