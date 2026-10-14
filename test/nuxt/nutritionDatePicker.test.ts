import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionDatePicker from '../../app/components/nutrition/NutritionDatePicker.vue'

const narrow = vi.hoisted(() => ({ value: false }))
vi.mock('~/composables/useIsNarrow', () => ({ useIsNarrow: () => ref(narrow.value) }))

let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

describe('NutritionDatePicker', () => {
  it.each([
    ['popover', false],
    ['sheet', true]
  ])('gives the labelled calendar root a group role in the %s', async (_, isNarrow) => {
    narrow.value = isNarrow
    wrapper = await mountSuspended(NutritionDatePicker, { props: { date: '2026-10-14', open: true } })
    const roots = document.querySelectorAll('[data-test="day-calendar"]')
    expect(roots).toHaveLength(1)
    expect(document.body.textContent?.includes('Go to date')).toBe(isNarrow)
    expect(roots[0]!.getAttribute('aria-label')).toBeTruthy()
    expect(roots[0]!.getAttribute('role')).toBe('group')
  })
})
