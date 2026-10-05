import type { VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { UCalendar } from '#components'
import WorkoutCalendarMonth from '../../app/components/workout/WorkoutCalendarMonth.vue'

const summary = (performedOn: string, categories: { id: number, color: string }[]) => ({
  id: Math.random(), name: null, performedOn, startedAt: `${performedOn}T15:00:00.000Z`, endedAt: null,
  exerciseCount: 1, setCount: 1, categories, program: null
})

describe('WorkoutCalendarMonth', () => {
  it('draws coloured dots on trained days, capped at four with a plus', async () => {
    const five = [1, 2, 3, 4, 5].map((id) => ({ id, color: ['rose', 'amber', 'orange', 'violet', 'sky'][id - 1]! }))
    const wrapper = await mountSuspended(WorkoutCalendarMonth, {
      props: { month: '2026-10', day: null, sessions: [summary('2026-10-01', [{ id: 1, color: 'rose' }]), summary('2026-10-02', five)] }
    })
    const first = wrapper.find('[data-test="calendar-day-2026-10-01"]')
    expect(first.findAll('[data-test="calendar-dot"]')).toHaveLength(1)
    expect(first.find('[data-test="calendar-dot"]').attributes('class')).toContain('bg-rose-500')
    const second = wrapper.find('[data-test="calendar-day-2026-10-02"]')
    expect(second.findAll('[data-test="calendar-dot"]')).toHaveLength(4)
    expect(second.find('[data-test="calendar-dot-more"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="calendar-day-2026-10-03"]').findAll('[data-test="calendar-dot"]')).toHaveLength(0)
  })

  it('tints the selected day instead of filling it, so a rose dot stays visible', async () => {
    const wrapper = await mountSuspended(WorkoutCalendarMonth, {
      props: { month: '2026-10', day: '2026-10-01', sessions: [summary('2026-10-01', [{ id: 1, color: 'rose' }])] }
    })
    const trigger = wrapper.find('[data-test="calendar-day-2026-10-01"]').element.closest('[data-selected]')!
    expect(trigger.className).toContain('data-selected:bg-primary/10')
    expect(trigger.className).not.toMatch(/data-selected:bg-primary(\s|$)/)
    const dot = wrapper.find('[data-test="calendar-day-2026-10-01"] [data-test="calendar-dot"]')
    expect(dot.attributes('class')).toContain('size-1.5')
    expect(dot.attributes('class')).not.toContain('ring')
  })

  it('underlines days with a program workout in the phase colour', async () => {
    const tagged = { ...summary('2026-10-01', [{ id: 1, color: 'rose' }]), program: { phaseId: 4, phaseName: 'Peak', phaseIndex: 1, week: 2 } }
    const wrapper = await mountSuspended(WorkoutCalendarMonth, {
      props: { month: '2026-10', day: null, sessions: [tagged, summary('2026-10-02', [{ id: 1, color: 'rose' }])] }
    })
    const marked = wrapper.find('[data-test="calendar-day-2026-10-01"] [data-test="calendar-phase"]')
    expect(marked.exists()).toBe(true)
    expect(marked.attributes('class')).toContain('bg-')
    expect(marked.attributes('class')).not.toContain('bg-transparent')
    expect(wrapper.find('[data-test="calendar-day-2026-10-02"] [data-test="calendar-phase"]').exists()).toBe(false)
  })

  it('emits the tapped day', async () => {
    const wrapper = await mountSuspended(WorkoutCalendarMonth, { props: { month: '2026-10', day: null, sessions: [] } })
    await wrapper.find('[data-test="calendar-day-2026-10-15"]').trigger('click')
    expect(wrapper.emitted('update:day')?.at(-1)).toEqual(['2026-10-15'])
  })

  it('keeps the day selected when the selected day is tapped again', async () => {
    const wrapper = await mountSuspended(WorkoutCalendarMonth, { props: { month: '2026-10', day: '2026-10-15', sessions: [] } })
    await wrapper.find('[data-test="calendar-day-2026-10-15"]').trigger('click')
    const calendar = wrapper.findComponent(UCalendar) as unknown as VueWrapper
    calendar.vm.$emit('update:modelValue', undefined)
    await nextTick()
    const emitted = wrapper.emitted('update:day') ?? []
    expect(emitted.every((args) => args[0] !== undefined && args[0] !== null)).toBe(true)
  })
})
