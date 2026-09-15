import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { USelect } from '#components'
import NutritionQuickAddForm from '../../app/components/nutrition/NutritionQuickAddForm.vue'

interface SelectProbe {
  props: (key: string) => unknown
}

const containers = [
  { id: 1, name: 'Breakfast' },
  { id: 2, name: 'Lunch' }
]

describe('NutritionQuickAddForm', () => {
  it('defaults the container select to defaultContainerId when given', async () => {
    const wrapper = await mountSuspended(NutritionQuickAddForm, {
      props: { containers, defaultContainerId: 2 }
    })
    const select = wrapper.findComponent(USelect) as unknown as SelectProbe
    expect(select.props('modelValue')).toBe(2)
  })

  it('falls back to the first container when defaultContainerId is not set', async () => {
    const wrapper = await mountSuspended(NutritionQuickAddForm, {
      props: { containers }
    })
    const select = wrapper.findComponent(USelect) as unknown as SelectProbe
    expect(select.props('modelValue')).toBe(1)
  })
})
