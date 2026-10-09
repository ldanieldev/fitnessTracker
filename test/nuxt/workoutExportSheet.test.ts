import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutExportSheet from '../../app/components/workout/WorkoutExportSheet.vue'

const q = (sel: string) => document.querySelector<HTMLElement>(`[data-test="${sel}"]`)
const input = (sel: string) => (q(sel)?.querySelector('input') ?? q(sel)) as HTMLInputElement
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('WorkoutExportSheet', () => {
  it('downloads the filtered export for the range', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    const wrapper = await mountSuspended(WorkoutExportSheet, { props: { open: true, filter: { categories: [3] } }, attachTo: document.body })
    await flush()
    const from = input('export-from')
    from.value = '2026-01-01'
    from.dispatchEvent(new Event('input'))
    await flush()
    q('export-download')!.click()
    await flush()
    expect(assign).toHaveBeenCalledWith('/api/workouts/sessions/export?from=2026-01-01&categories=3')
    wrapper.unmount()
    assign.mockRestore()
  })

  it('blocks a range that ends before it starts', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    const wrapper = await mountSuspended(WorkoutExportSheet, { props: { open: true, filter: {} }, attachTo: document.body })
    await flush()
    for (const [sel, value] of [['export-from', '2026-02-01'], ['export-to', '2026-01-01']] as const) {
      const el = input(sel)
      el.value = value
      el.dispatchEvent(new Event('input'))
    }
    await flush()
    q('export-download')!.click()
    await flush()
    expect(assign).not.toHaveBeenCalled()
    expect(q('export-error')?.textContent).toContain('before')
    wrapper.unmount()
    assign.mockRestore()
  })
})
