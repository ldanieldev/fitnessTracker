import { describe, expect, it } from 'vitest'
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { ComponentPublicInstance } from 'vue'
import { UCalendar } from '#components'
import DashboardDateRangePicker from '../../app/components/dashboard/DashboardDateRangePicker.vue'

const CalendarCtor = UCalendar as unknown as new () => ComponentPublicInstance<{ maxValue?: CalendarDate }>
const initial = { start: new Date(2026, 8, 1), end: new Date(2026, 8, 14) }

async function openPicker() {
  const wrapper = await mountSuspended(DashboardDateRangePicker, { props: { modelValue: initial } })
  await wrapper.get('button').trigger('click')
  return { wrapper, calendar: wrapper.findComponent(CalendarCtor) }
}

describe('DashboardDateRangePicker', () => {
  it('holds a lone start date and commits only once the end is picked', async () => {
    const { wrapper, calendar } = await openPicker()
    await calendar.vm.$emit('update:modelValue', { start: new CalendarDate(2026, 10, 1), end: undefined })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await calendar.vm.$emit('update:modelValue', {
      start: new CalendarDate(2026, 10, 1),
      end: new CalendarDate(2026, 10, 5)
    })
    expect(wrapper.emitted('update:modelValue')).toEqual([[{ start: new Date(2026, 9, 1), end: new Date(2026, 9, 5) }]])
  })

  it('caps the calendar at today', async () => {
    const { calendar } = await openPicker()
    expect(calendar.props('maxValue')?.compare(today(getLocalTimeZone()))).toBe(0)
  })
})
