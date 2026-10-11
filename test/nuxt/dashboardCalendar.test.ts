import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DashboardCalendar from '../../app/components/dashboard/DashboardCalendar.vue'
import { calendarColumns } from '../../shared/utils/dashboard'

describe('DashboardCalendar', () => {
  it('renders 12 labelled columns, filled days, today and week bars', async () => {
    const columns = calendarColumns('2026-10-11', 0)
    const wrapper = await mountSuspended(DashboardCalendar, {
      props: {
        columns,
        days: ['2026-10-05', '2026-10-11'],
        today: '2026-10-11',
        fill: 'bg-red-500',
        weekBars: [...Array(10).fill(null), true, null]
      }
    })
    expect(wrapper.findAll('[data-test="calendar-month"]').map((m) => m.text()).filter(Boolean)).toEqual([
      'Aug', 'Sep', 'Oct'
    ])
    expect(wrapper.findAll('[data-day]')).toHaveLength(84)
    expect(wrapper.findAll('[data-hit="true"]').map((c) => c.attributes('data-day')).sort()).toEqual([
      '2026-10-05', '2026-10-11'
    ])
    expect(wrapper.find('[data-today="true"]').attributes('data-day')).toBe('2026-10-11')
    expect(wrapper.findAll('[data-future="true"]')).toHaveLength(6)
    expect(wrapper.findAll('[data-met]').map((b) => b.attributes('data-met')).slice(-2)).toEqual(['true', 'null'])
    expect(wrapper.get('[data-test="calendar"]').classes()).toContain('max-w-sm')
  })

  it('renders a loading grid with the same cells and no hits or today ring', async () => {
    const wrapper = await mountSuspended(DashboardCalendar, {
      props: {
        columns: calendarColumns('2026-10-11', 0),
        days: ['2026-10-05'],
        today: '2026-10-11',
        weekBars: [],
        loading: true
      }
    })
    expect(wrapper.findAll('[data-day]')).toHaveLength(84)
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-hit="true"]')).toHaveLength(0)
    expect(wrapper.find('.ring-1').exists()).toBe(false)
    expect(wrapper.findAll('[data-met]')).toHaveLength(12)
  })

  it('is one labelled image summarising the non-future days hit', async () => {
    const wrapper = await mountSuspended(DashboardCalendar, {
      props: {
        columns: calendarColumns('2026-10-11', 0),
        days: ['2026-10-05', '2026-10-11', '2026-10-12'],
        today: '2026-10-11',
        fill: 'bg-red-500'
      }
    })
    const root = wrapper.get('[data-test="calendar"]')
    expect(root.attributes('role')).toBe('img')
    expect(root.attributes('aria-label')).toBe('2 of 78 days')
    expect(root.classes()).toContain('mx-auto')
    expect(root.findAll(':scope > *').every((child) => child.attributes('aria-hidden') === 'true')).toBe(true)
    expect(wrapper.findAll('[data-met]')).toHaveLength(0)
  })

  it('needs no fill or bar values while loading', async () => {
    const wrapper = await mountSuspended(DashboardCalendar, {
      props: { columns: calendarColumns('2026-10-11', 0), days: [], today: '2026-10-11', loading: true }
    })
    expect(wrapper.findAll('[data-day]')).toHaveLength(84)
    expect(wrapper.findAll('[data-met]')).toHaveLength(0)
  })

  describe('tap tooltip', () => {
    async function grid() {
      return mountSuspended(DashboardCalendar, {
        props: { columns: calendarColumns('2026-10-11', 0), days: [], today: '2026-10-11' },
        attachTo: document.body
      })
    }
    const tap = (el: { trigger: (e: string, init: object) => Promise<void> }, pointerType = 'touch') =>
      el.trigger('pointerup', { pointerType })

    it('shows the tapped date on touch and closes on a second tap', async () => {
      const wrapper = await grid()
      const cell = wrapper.get('[data-day="2026-10-09"]')
      await tap(cell)
      expect(wrapper.get('[data-test="calendar-tip"]').text()).toBe('Fri, Oct 9')
      await tap(cell)
      expect(wrapper.find('[data-test="calendar-tip"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('shows the same bubble on mouse hover instead of a native title, and hides it on leave', async () => {
      const wrapper = await grid()
      const cell = wrapper.get('[data-day="2026-10-09"]')
      expect(cell.attributes('title')).toBeUndefined()
      await tap(cell, 'mouse')
      expect(wrapper.find('[data-test="calendar-tip"]').exists()).toBe(false)
      await cell.trigger('pointerover', { pointerType: 'mouse' })
      expect(wrapper.get('[data-test="calendar-tip"]').text()).toBe('Fri, Oct 9')
      await wrapper.get('[data-test="calendar"]').trigger('pointerleave', { pointerType: 'mouse' })
      expect(wrapper.find('[data-test="calendar-tip"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('skips future days and closes on a tap outside the grid', async () => {
      const wrapper = await grid()
      await tap(wrapper.get('[data-future="true"]'))
      expect(wrapper.find('[data-test="calendar-tip"]').exists()).toBe(false)
      await tap(wrapper.get('[data-day="2026-10-09"]'))
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await nextTick()
      expect(wrapper.find('[data-test="calendar-tip"]').exists()).toBe(false)
      wrapper.unmount()
    })
  })
})
