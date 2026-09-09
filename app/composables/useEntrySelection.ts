export function useEntrySelection() {
  const state = reactive({
    active: false,
    selected: new Set<number>()
  })

  function toggle() {
    state.active = !state.active
    if (!state.active) state.selected.clear()
  }

  function toggleEntry(id: number) {
    if (state.selected.has(id)) state.selected.delete(id)
    else state.selected.add(id)
  }

  function clear() {
    state.active = false
    state.selected.clear()
  }

  return { state, toggle, toggleEntry, clear }
}
