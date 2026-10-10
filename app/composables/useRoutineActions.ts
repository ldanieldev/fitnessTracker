import type { Routine } from '~~/shared/types/routine'

export function useRoutineActions() {
  const fail = useFailToast()
  const deleting = ref<{ id: number; name: string } | null>(null)
  const deleteOpen = ref(false)

  async function duplicate(target: { id: number }) {
    try {
      const copy = await apiFetch<Routine>(`/api/workouts/routines/${target.id}/duplicate`, { method: 'POST' })
      await invalidateWorkouts()
      await navigateTo(`/workouts/routines/${copy.id}`)
    } catch (err: unknown) {
      fail('Couldn\'t duplicate routine', err, 'Could not duplicate this routine', () => duplicate(target))
    }
  }

  function askDelete(target: { id: number; name: string }) {
    deleting.value = target
    deleteOpen.value = true
  }

  async function confirmDelete(onDeleted?: () => unknown) {
    const routine = deleting.value
    deleteOpen.value = false
    if (!routine) return
    try {
      await apiFetch(`/api/workouts/routines/${routine.id}`, { method: 'DELETE' })
      await onDeleted?.()
      await invalidateWorkouts()
    } catch (err: unknown) {
      fail('Couldn\'t delete routine', err, 'Could not delete this routine')
    }
  }

  return { duplicate, deleting, deleteOpen, askDelete, confirmDelete }
}
