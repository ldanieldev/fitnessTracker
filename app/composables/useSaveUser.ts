export function useSaveUser() {
  const { user, fetch: fetchSession } = useUserSession()
  const fail = useFailToast()
  return async (body: Record<string, unknown>, fallback: string): Promise<boolean> => {
    try {
      await apiFetch(`/api/users/${user.value!.id}`, { method: 'PUT', body })
      await fetchSession()
      return true
    } catch (error: unknown) {
      fail('Save failed', error, fallback)
      return false
    }
  }
}
