import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import SettingsWorkoutFitNotesImport from '../../app/components/settings/SettingsWorkoutFitNotesImport.vue'
import type { FitNotesPreview } from '../../shared/types/fitnotes'

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))

const preview: FitNotesPreview = {
  sets: 10,
  days: 3,
  firstDate: '2026-09-28',
  lastDate: '2026-10-01',
  existingDays: 1,
  importedDays: 0,
  exercises: [
    {
      name: 'Barbell Squat',
      category: 'Legs',
      sets: 3,
      days: 2,
      firstDate: '2026-09-29',
      lastDate: '2026-10-01',
      trackingType: 'weight_reps',
      assisted: false,
      match: { id: 11, name: 'Barbell Squat', custom: false },
      suggestions: []
    },
    {
      name: 'Flat Barbell Bench Press',
      category: 'Chest',
      sets: 2,
      days: 1,
      firstDate: '2026-09-28',
      lastDate: '2026-09-28',
      trackingType: 'weight_reps',
      assisted: false,
      match: null,
      suggestions: [{ id: 22, name: 'Barbell Bench Press - Medium Grip', custom: false }]
    },
    {
      name: 'Chin Up',
      category: 'Back',
      sets: 2,
      days: 1,
      firstDate: '2017-09-29',
      lastDate: '2026-09-29',
      trackingType: 'weight_reps',
      assisted: true,
      match: null,
      suggestions: []
    }
  ]
}

function selectFile(wrapper: Awaited<ReturnType<typeof mountSuspended>>, text: string) {
  const input = wrapper.find('input[data-test="fitnotes-file"]').element as HTMLInputElement
  const file = new File([text], 'FitNotes_Export.csv', { type: 'text/csv' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change'))
}

afterEach(() => {
  toastAdd.mockReset()
  vi.useRealTimers()
})

describe('SettingsWorkoutFitNotesImport', () => {
  it('previews the file, shows matches, applies a suggestion, filters to new ones and posts the mapping', async () => {
    let previewBody: unknown = null
    let importBody: unknown = null
    registerEndpoint('/api/workouts/import/fitnotes/preview', {
      method: 'POST',
      handler: async (event) => {
        previewBody = await readBody(event)
        return preview
      }
    })
    registerEndpoint('/api/workouts/import/fitnotes', {
      method: 'POST',
      handler: async (event) => {
        importBody = await readBody(event)
        return { jobId: 7 }
      }
    })
    const wrapper = await mountSuspended(SettingsWorkoutFitNotesImport)
    selectFile(wrapper, 'csv text')
    await vi.waitFor(() => expect(wrapper.find('[data-test="fitnotes-summary"]').exists()).toBe(true))
    expect(previewBody).toEqual({ csv: 'csv text' })
    expect(wrapper.find('[data-test="fitnotes-summary"]').text()).toContain('10 sets on 3 days')
    expect(wrapper.find('[data-test="fitnotes-summary"]').text()).toContain('1 exercise matched · 2 to create')
    expect(wrapper.find('[data-test="fitnotes-target-Barbell Squat"]').text()).toBe('Barbell Squat')
    expect(wrapper.find('[data-test="fitnotes-row-Chin Up"]').text()).toContain('2017–2026 · assisted')

    await wrapper.find('[data-test="fitnotes-suggest-Flat Barbell Bench Press-22"]').trigger('click')
    expect(wrapper.find('[data-test="fitnotes-target-Flat Barbell Bench Press"]').text()).toBe(
      'Barbell Bench Press - Medium Grip'
    )
    await wrapper.find('[data-test="fitnotes-new-Barbell Squat"]').trigger('click')
    expect(wrapper.find('[data-test="fitnotes-target-Barbell Squat"]').text()).toBe('New exercise')

    await wrapper.find('[data-test="fitnotes-only-new"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="fitnotes-row-Flat Barbell Bench Press"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="fitnotes-row-Chin Up"]').exists()).toBe(true)

    await wrapper.find('[data-test="fitnotes-skip-existing"]').trigger('click')
    await wrapper.find('[data-test="fitnotes-submit"]').trigger('click')
    await vi.waitFor(() => expect(importBody).not.toBeNull())
    expect(importBody).toEqual({
      csv: 'csv text',
      mapping: { 'Barbell Squat': null, 'Flat Barbell Bench Press': 22, 'Chin Up': null },
      skipExistingDays: false
    })
    wrapper.unmount()
  })

  it('polls the job and reports the result', async () => {
    registerEndpoint('/api/workouts/import/fitnotes/preview', { method: 'POST', handler: () => preview })
    registerEndpoint('/api/workouts/import/fitnotes', { method: 'POST', handler: () => ({ jobId: 8 }) })
    registerEndpoint('/api/workouts/import/fitnotes/8', () => ({
      id: 8,
      status: 'done',
      error: null,
      result: {
        daysImported: 2,
        daysSkippedImported: 0,
        daysSkippedExisting: 1,
        sets: 8,
        exercisesCreated: 2,
        categoriesCreated: 0
      }
    }))
    const wrapper = await mountSuspended(SettingsWorkoutFitNotesImport)
    selectFile(wrapper, 'csv')
    await vi.waitFor(() => expect(wrapper.find('[data-test="fitnotes-submit"]').exists()).toBe(true))
    await wrapper.find('[data-test="fitnotes-submit"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-test="fitnotes-result"]').exists()).toBe(true), {
      timeout: 4000
    })
    expect(wrapper.find('[data-test="fitnotes-result"]').text()).toContain('2 days and 8 sets imported')
    expect(wrapper.find('[data-test="fitnotes-result"]').text()).toContain('1 day skipped')
    wrapper.unmount()
  })

  it('previews a dropped .csv and rejects a dropped file of another type without uploading it', async () => {
    let previews = 0
    registerEndpoint('/api/workouts/import/fitnotes/preview', {
      method: 'POST',
      handler: () => {
        previews++
        return preview
      }
    })
    const wrapper = await mountSuspended(SettingsWorkoutFitNotesImport)
    const drop = (file: File) => {
      const event = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: { files: [file], items: [{ type: file.type }] } })
      wrapper.find('[role="button"][data-slot="base"]').element.dispatchEvent(event)
    }

    drop(new File(['x'], 'notes.txt', { type: 'text/plain' }))
    await flushPromises()
    expect(toastAdd.mock.calls[0]![0]).toMatchObject({ title: 'Can’t read this file', color: 'error' })
    expect(previews).toBe(0)

    drop(new File(['csv'], 'FitNotes_Export.csv', { type: 'application/vnd.ms-excel' }))
    await vi.waitFor(() => expect(wrapper.find('[data-test="fitnotes-summary"]').exists()).toBe(true))
    expect(previews).toBe(1)
    wrapper.unmount()
  })

  it('toasts and stays on the file picker when the file is not a FitNotes export', async () => {
    registerEndpoint('/api/workouts/import/fitnotes/preview', {
      method: 'POST',
      handler: () => {
        throw createError({ statusCode: 400, statusMessage: 'Not a FitNotes export' })
      }
    })
    const wrapper = await mountSuspended(SettingsWorkoutFitNotesImport)
    selectFile(wrapper, 'nope')
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalled())
    expect(toastAdd.mock.calls[0]![0]).toMatchObject({ title: 'Can’t read this file', color: 'error' })
    expect(wrapper.find('input[data-test="fitnotes-file"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
