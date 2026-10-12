import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SettingsNutritionContainers from '../../app/components/settings/SettingsNutritionContainers.vue'

describe('SettingsNutritionContainers', () => {
  it('names every text field for assistive tech', async () => {
    const wrapper = await mountSuspended(SettingsNutritionContainers, {
      props: { containers: [{ id: 1, name: 'Breakfast', sortOrder: 0, isArchived: false }] }
    })
    expect(wrapper.find('[data-test="container-name-1"]').attributes('aria-label')).toBe('Rename Breakfast')
    expect(wrapper.find('[data-test="add-container-input"]').attributes('aria-label')).toBe('New container name')
  })
})
