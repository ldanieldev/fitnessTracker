import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { DOMWrapper } from '@vue/test-utils'
import NutritionCopyDialog from '../../app/components/nutrition/NutritionCopyDialog.vue'

const sourceEntries = [
  { id: 1, containerId: 10, description: 'Oats', quantity: 100, unitLabel: 'g' },
  { id: 2, containerId: 10, description: 'Milk', quantity: 200, unitLabel: 'g' },
  { id: 3, containerId: 20, description: 'Eggs', quantity: 2, unitLabel: 'egg' },
  { id: 4, containerId: 20, description: 'Toast', quantity: 1, unitLabel: 'slice' }
]

const containers = [{ id: 10, name: 'Breakfast' }, { id: 20, name: 'Lunch' }]

let activeWrapper: { unmount: () => void } | undefined

afterEach(() => {
  activeWrapper?.unmount()
  activeWrapper = undefined
  document.body.innerHTML = ''
})

// UModal teleports to document.body, which findAllComponents can't see without a subTree, so tests drive the real body through DOM events.
async function mountDialog() {
  const wrapper = await mountSuspended(NutritionCopyDialog, {
    attachTo: document.body,
    props: { open: true, sourceEntries, containers, defaultDate: '2026-08-02' }
  })
  activeWrapper = wrapper
  return { wrapper, body: new DOMWrapper(document.body) }
}

describe('NutritionCopyDialog', () => {
  it('checks all sources by default and copies them unchanged into their own containers', async () => {
    const { wrapper, body } = await mountDialog()
    const checkboxes = body.findAll('[data-test="copy-source-checkbox"]')
    expect(checkboxes).toHaveLength(4)
    for (const checkbox of checkboxes) expect(checkbox.attributes('aria-checked')).toBe('true')

    await body.find('[data-test="copy-confirm"]').trigger('click')
    const confirmed = wrapper.emitted('confirm')
    expect(confirmed).toHaveLength(1)
    expect(confirmed![0]![0]).toEqual({
      sourceEntryIds: [1, 2, 3, 4],
      targetDate: '2026-08-02',
      targetContainerId: null,
      overrides: []
    })
  })

  it('unchecking one entry excludes it from the payload', async () => {
    const { wrapper, body } = await mountDialog()
    const checkboxes = body.findAll('[data-test="copy-source-checkbox"]')
    await checkboxes[0]!.trigger('click')

    await body.find('[data-test="copy-confirm"]').trigger('click')
    const payload = wrapper.emitted('confirm')![0]![0] as { overrides: unknown[] }
    expect(payload.overrides).toContainEqual({ sourceEntryId: 1, exclude: true })
  })

  it('changing an amount emits a quantity override', async () => {
    const { wrapper, body } = await mountDialog()
    const quantityInputs = body.findAll('[data-test="copy-source-quantity"]')
    await quantityInputs[0]!.setValue('250')
    await quantityInputs[0]!.trigger('blur')

    await body.find('[data-test="copy-confirm"]').trigger('click')
    const payload = wrapper.emitted('confirm')![0]![0] as { overrides: unknown[] }
    expect(payload.overrides).toContainEqual({ sourceEntryId: 1, quantity: 250 })
  })

  it('disables confirm and emits nothing once every entry is unchecked', async () => {
    const { wrapper, body } = await mountDialog()
    const checkboxes = body.findAll('[data-test="copy-source-checkbox"]')
    for (const checkbox of checkboxes) await checkbox.trigger('click')

    const confirmButton = body.find('[data-test="copy-confirm"]')
    expect(confirmButton.attributes('disabled')).toBeDefined()

    await confirmButton.trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})
