import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery, readBody } from 'h3'
import ExerciseCategoryEditor from '../../app/components/workout/ExerciseCategoryEditor.vue'

const category = (id: number, name: string, sortOrder: number, shared: boolean) => ({
  id, key: shared ? name.toLowerCase() : null, name, color: 'rose', sortOrder, shared, hidden: false
})
const categories = [category(1, 'Chest', 0, true), category(2, 'Back', 1, true), category(3, 'Grip', 2, false)]

interface Call { method: string, id: number, body: unknown, query: Record<string, unknown> }
let calls: Call[] = []

registerEndpoint('/api/workouts/categories', { method: 'GET', handler: () => categories })
registerEndpoint('/api/workouts/categories', {
  method: 'POST',
  handler: async (event) => {
    calls.push({ method: 'POST', id: 0, body: await readBody(event), query: {} })
    return category(4, 'New', 3, false)
  }
})
for (const id of [1, 2, 3]) {
  for (const method of ['PATCH', 'DELETE'] as const) {
    registerEndpoint(`/api/workouts/categories/${id}`, {
      method,
      handler: async (event) => {
        calls.push({ method, id, body: method === 'PATCH' ? await readBody(event) : undefined, query: getQuery(event) })
        return { ok: true }
      }
    })
  }
}

// AppSheet teleports its body out of the mounted subtree, so query the attached document instead of wrapper.find.
function find(selector: string) {
  return new DOMWrapper(document.querySelector(selector))
}

let wrapper: Awaited<ReturnType<typeof mountSuspended>>

beforeEach(async () => {
  calls = []
  wrapper = await mountSuspended(ExerciseCategoryEditor, { attachTo: document.body, props: { open: true } })
  await flushPromises()
  await vi.waitFor(() => expect(document.querySelector('[data-test="category-name-1"]')).not.toBeNull())
})

afterEach(() => {
  wrapper.unmount()
  document.body.innerHTML = ''
})

describe('ExerciseCategoryEditor', () => {
  it('renames on blur and skips an unchanged name', async () => {
    await find('[data-test="category-name-1"]').setValue('Pecs')
    await find('[data-test="category-name-1"]').trigger('blur')
    await vi.waitFor(() => expect(calls).toEqual([{ method: 'PATCH', id: 1, body: { name: 'Pecs' }, query: {} }]))
    await find('[data-test="category-name-2"]').trigger('blur')
    await flushPromises()
    expect(calls).toHaveLength(1)
  })

  it('swaps sort orders with the neighbour, neighbour first', async () => {
    expect(find('[data-test="category-up-1"]').attributes('disabled')).toBeDefined()
    await find('[data-test="category-down-1"]').trigger('click')
    await vi.waitFor(() => expect(calls).toHaveLength(2))
    expect(calls.map((c) => [c.id, c.body])).toEqual([[2, { sortOrder: 0 }], [1, { sortOrder: 1 }]])
  })

  it('offers hide for shared categories and delete for custom ones', async () => {
    expect(find('[data-test="category-hide-1"]').exists()).toBe(true)
    expect(find('[data-test="category-delete-1"]').exists()).toBe(false)
    expect(find('[data-test="category-delete-3"]').exists()).toBe(true)
    await find('[data-test="category-hide-1"]').trigger('click')
    await vi.waitFor(() => expect(calls).toEqual([{ method: 'PATCH', id: 1, body: { hidden: true }, query: {} }]))
  })

  it('deletes a custom category into the first shared one by default', async () => {
    await find('[data-test="category-delete-3"]').trigger('click')
    expect(document.body.textContent).toContain('Move exercises in "Grip" to:')
    await find('[data-test="category-delete-confirm"]').trigger('click')
    await vi.waitFor(() => expect(calls).toEqual([{ method: 'DELETE', id: 3, body: undefined, query: { moveTo: '1' } }]))
  })

  it('sets a new colour and ignores the current one', async () => {
    await find('[data-test="category-color-1-rose"]').trigger('click')
    await find('[data-test="category-color-2-sky"]').trigger('click')
    await vi.waitFor(() => expect(calls).toEqual([{ method: 'PATCH', id: 2, body: { color: 'sky' }, query: {} }]))
  })

  it('creates a category with the typed name and the default colour', async () => {
    await find('[data-test="category-new-name"]').setValue('  Carries  ')
    await find('[data-test="category-new-save"]').trigger('click')
    await vi.waitFor(() => expect(calls).toEqual([{ method: 'POST', id: 0, body: { name: 'Carries', color: 'rose' }, query: {} }]))
    await vi.waitFor(() => expect((find('[data-test="category-new-name"]').element as HTMLInputElement).value).toBe(''))
  })
})
