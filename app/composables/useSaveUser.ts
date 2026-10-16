import { errorMessage } from '~/utils/apiError'

export function useSaveUser() {
  const { user, fetch: fetchSession } = useUserSession()
  const toast = useToast()
  return async (body: Record<string, unknown>, fallback: string): Promise<boolean> => {
    try {
      await apiFetch(`/api/users/${user.value!.id}`, { method: 'PUT', body })
      await fetchSession()
      return true
    } catch (error: unknown) {
      toast.add({ title: 'Save failed', description: errorMessage(error, fallback), color: 'error' })
      return false
    }
  }
}
