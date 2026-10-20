export const OAUTH_PROVIDERS = ['google', 'github'] as const
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]

export function configuredOAuthProviders(
  oauth: Record<OAuthProvider, { clientId: string, clientSecret: string }>
): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((provider) => oauth[provider].clientId && oauth[provider].clientSecret)
}
