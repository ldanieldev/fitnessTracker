import type { Program } from '~~/shared/types/program'

export function useProgramActions() {
  const fail = useFailToast()
  const deleting = ref<{ id: number; name: string } | null>(null)
  const deleteOpen = ref(false)

  async function duplicate(target: { id: number }) {
    try {
      const copy = await apiFetch<Program>(`/api/workouts/programs/${target.id}/duplicate`, { method: 'POST' })
      await invalidateWorkouts()
      await navigateTo(`/workouts/programs/${copy.id}`)
    } catch (err: unknown) {
      fail('Couldn\'t duplicate program', err, 'Could not duplicate this program')
    }
  }

  async function exportProgram(target: { id: number }) {
    let filename = 'program.json'
    try {
      const blob = await apiFetch<Blob>(`/api/workouts/programs/${target.id}/export`, {
        responseType: 'blob',
        onResponse: ({ response }) => {
          filename = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? filename
        }
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      fail('Couldn\'t export program', err, 'Could not export this program')
    }
  }

  function askDelete(target: { id: number; name: string }) {
    deleting.value = target
    deleteOpen.value = true
  }

  async function confirmDelete(onDeleted?: () => unknown) {
    const program = deleting.value
    deleteOpen.value = false
    if (!program) return
    try {
      await apiFetch(`/api/workouts/programs/${program.id}`, { method: 'DELETE' })
      await onDeleted?.()
      await invalidateWorkouts()
    } catch (err: unknown) {
      fail('Couldn\'t delete program', err, 'Could not delete this program')
    }
  }

  return { duplicate, exportProgram, deleting, deleteOpen, askDelete, confirmDelete }
}
