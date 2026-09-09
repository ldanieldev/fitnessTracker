import { describe, expect, it } from 'vitest'

describe('useEntrySelection', () => {
  it('clear resets both the active flag and the selected ids', async () => {
    const { useEntrySelection } = await import('../../app/composables/useEntrySelection')
    const selection = useEntrySelection()

    selection.state.active = true
    selection.toggleEntry(5)
    expect(selection.state.selected.has(5)).toBe(true)

    selection.clear()

    expect(selection.state.active).toBe(false)
    expect(selection.state.selected.size).toBe(0)
  })
})
