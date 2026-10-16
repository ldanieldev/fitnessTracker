import { isValidTokenKey } from './crypto'

export function googleHealthConfig() {
  const config = useRuntimeConfig()
  const clientId = config.oauth?.google?.clientId ?? ''
  const clientSecret = config.oauth?.google?.clientSecret ?? ''
  const { tokenKey, apiBase, tokenUrl, revokeUrl } = config.googleHealth
  return {
    clientId,
    clientSecret,
    tokenKey,
    apiBase,
    tokenUrl,
    revokeUrl,
    available: Boolean(clientId && clientSecret && isValidTokenKey(tokenKey))
  }
}
