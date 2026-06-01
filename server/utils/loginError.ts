import type { H3Event } from 'h3'
import type { OAuthErrorCode } from '#shared/utils/oauthErrors'

const LOGIN_PATH = '/auth/login'

export function loginError(event: H3Event, code: OAuthErrorCode) {
  return sendRedirect(event, `${LOGIN_PATH}?error=${code}`)
}
