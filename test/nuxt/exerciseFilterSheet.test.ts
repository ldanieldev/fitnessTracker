import { describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, getQuery } from 'h3'
import ExerciseFilterSheet from '../../app/components/workout/ExerciseFilterSheet.vue'

const props = {
  open: true,
  muscles: [
    { key: 'chest', name: 'Chest', bodyMapGroups: ['CHEST'] },
    { key: 'lats', name: 'Lats', bodyMapGroups: ['LATS'] }
  ],
  equipment: [
    { key: 'barbell', name: 'Barbell' },
    { key: 'cable', name: 'Cable' }
  ],
  filters: { muscles: [], equipment: [], difficulty: null, includeHidden: false }
}

let facet: string[] | 'error' = ['chest', 'lats']
let lastQuery: Record<string, unknown> | null = null
let gate: Promise<void> | null = null
registerEndpoint('/api/workouts/exercises/muscles', {
  method: 'GET',
  handler: async (event) => {
    lastQuery = getQuery(event)
    if (gate) await gate
    if (facet === 'error') throw createError({ statusCode: 500, statusMessage: 'boom' })
    return facet
  }
})

const isDisabled = (key: string) => find(`[data-test="muscle-${key}"]`).attributes('disabled') !== undefined

// AppSheet teleports its body out of the mounted subtree, so query the attached document instead of wrapper.find.
function find(selector: string) {
  return new DOMWrapper(document.querySelector(selector))
}

describe('ExerciseFilterSheet', () => {
  it('applies the muscles picked on the body map', async () => {
    const wrapper = await mountSuspended(ExerciseFilterSheet, { attachTo: document.body, props })
    await flushPromises()
    await find('[data-test="muscle-chest"]').trigger('click')
    await find('[data-test="filter-apply"]').trigger('click')
    expect(wrapper.emitted('apply')![0]![0]).toMatchObject({ muscles: ['chest'] })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('applies equipment and difficulty together', async () => {
    const wrapper = await mountSuspended(ExerciseFilterSheet, { attachTo: document.body, props })
    await flushPromises()
    await find('[data-test="equipment-barbell"]').trigger('click')
    await find('[data-test="difficulty-beginner"]').trigger('click')
    await find('[data-test="filter-apply"]').trigger('click')
    expect(wrapper.emitted('apply')![0]![0]).toMatchObject({ equipment: ['barbell'], difficulty: 'beginner' })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('clears every filter at once', async () => {
    const wrapper = await mountSuspended(ExerciseFilterSheet, {
      attachTo: document.body,
      props: {
        ...props,
        filters: { muscles: ['chest'], equipment: ['cable'], difficulty: 'beginner', includeHidden: true }
      }
    })
    await flushPromises()
    await find('[data-test="filter-clear"]').trigger('click')
    await find('[data-test="filter-apply"]').trigger('click')
    const applied = wrapper.emitted('apply')![0]![0]
    expect(applied).toEqual({ muscles: [], equipment: [], difficulty: null, includeHidden: false })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('carries the show-hidden switch into the applied filters', async () => {
    const wrapper = await mountSuspended(ExerciseFilterSheet, { attachTo: document.body, props })
    await flushPromises()
    await find('[data-test="filter-hidden"]').trigger('click')
    await find('[data-test="filter-apply"]').trigger('click')
    expect(wrapper.emitted('apply')![0]![0]).toMatchObject({ includeHidden: true })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('dims muscles with no exercises under the current filter', async () => {
    lastQuery = null
    facet = ['chest']
    const wrapper = await mountSuspended(ExerciseFilterSheet, { attachTo: document.body, props })
    await vi.waitFor(() => expect(isDisabled('chest')).toBe(false))
    expect(isDisabled('lats')).toBe(true)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('asks with the sheet filters and the page scope, never the muscles', async () => {
    lastQuery = null
    facet = ['chest']
    const wrapper = await mountSuspended(ExerciseFilterSheet, {
      attachTo: document.body,
      props: {
        ...props,
        scope: { q: 'press', favorites: true },
        filters: { muscles: ['chest'], equipment: [], difficulty: null, includeHidden: false }
      }
    })
    await flushPromises()
    await find('[data-test="equipment-cable"]').trigger('click')
    await vi.waitFor(() => expect(lastQuery).toEqual({ q: 'press', equipment: 'cable', favorites: '1' }))
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('keeps a selected muscle toggleable when the facet drops it', async () => {
    lastQuery = null
    facet = ['chest']
    const wrapper = await mountSuspended(ExerciseFilterSheet, {
      attachTo: document.body,
      props: { ...props, filters: { muscles: ['lats'], equipment: [], difficulty: null, includeHidden: false } }
    })
    await vi.waitFor(() => expect(lastQuery).not.toBeNull())
    await flushPromises()
    expect(isDisabled('lats')).toBe(false)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('falls back to every muscle when the facet request fails', async () => {
    lastQuery = null
    facet = ['chest']
    const wrapper = await mountSuspended(ExerciseFilterSheet, { attachTo: document.body, props })
    await vi.waitFor(() => expect(isDisabled('chest')).toBe(false))
    expect(isDisabled('lats')).toBe(true)
    facet = 'error'
    await find('[data-test="equipment-cable"]').trigger('click')
    await vi.waitFor(() => expect(isDisabled('lats')).toBe(false))
    wrapper.unmount()
    document.body.innerHTML = ''
  })
  it('holds every unselected muscle untappable, undimmed, until the facet arrives — on each open', async () => {
    facet = ['chest']
    let release = () => {}
    gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const wrapper = await mountSuspended(ExerciseFilterSheet, { attachTo: document.body, props })
    try {
      await flushPromises()
      expect(isDisabled('chest')).toBe(true)
      expect(find('[data-test="muscle-chest"]').classes()).not.toContain('opacity-40')
      release()
      await vi.waitFor(() => expect(isDisabled('chest')).toBe(false))
      expect(isDisabled('lats')).toBe(true)

      gate = new Promise<void>((resolve) => {
        release = resolve
      })
      await wrapper.setProps({ open: false })
      await flushPromises()
      await wrapper.setProps({ open: true })
      await flushPromises()
      expect(isDisabled('chest')).toBe(true)
      release()
      await vi.waitFor(() => expect(isDisabled('chest')).toBe(false))
    } finally {
      gate = null
      release()
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })
})
