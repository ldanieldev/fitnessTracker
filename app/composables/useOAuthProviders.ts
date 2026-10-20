import type { OAuthProvider } from '~~/shared/utils/oauthProviders'

export async function useOAuthProviders() {
  const { data } = await useFetch<{ providers: OAuthProvider[] }>('/api/auth/oauth', { key: 'oauth-providers' })
  return computed(() => data.value?.providers ?? [])
}
