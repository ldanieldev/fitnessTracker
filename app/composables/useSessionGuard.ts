let redirecting = false

/**
 * De-dupes a burst of parallel 401s and never fires from an auth page itself (a login/register 401 is bad
 * credentials, not a stale session). Returns whether it acted — apiFetch uses that to decide whether the
 * original error should still reach the caller.
 */
export async function handleUnauthorized(): Promise<boolean> {
  if (redirecting) return true
  const route = useRoute()
  if (route.path.startsWith('/auth')) return false
  redirecting = true
  try {
    await useUserSession().clear()
    await navigateTo('/auth/login')
    return true
  } finally {
    redirecting = false
  }
}

function isUnauthorized(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode?: number }).statusCode === 401
}

// Nuxt's auto-imported $fetch is a boot-time snapshot (see useNutritionData.ts), so every call site uses this instead; its parameter types mirror $fetch's so call sites keep their inference.
export function apiFetch<T = unknown>(request: Parameters<typeof $fetch>[0], opts?: Parameters<typeof $fetch>[1]): Promise<T> {
  return $fetch<T>(request, opts).catch(async (error: unknown) => {
    if (isUnauthorized(error) && (await handleUnauthorized())) {
      // Never resolve: we're navigating away, so the caller's catch/finally (a toast, a `saving` reset) should never run.
      return new Promise<T>(() => {})
    }
    throw error
  })
}
