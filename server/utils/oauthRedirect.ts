import { withQuery } from 'ufo'
import type { H3Event } from 'h3'
import type { OAuthErrorCode } from '#shared/utils/oauthErrors'

const LOGIN_PATH = '/auth/login'
const RETURN_COOKIE = 'oauth-redirect'

export function loginError(event: H3Event, code: OAuthErrorCode) {
  return sendRedirect(event, `${LOGIN_PATH}?error=${code}`)
}

function takeReturnPath(event: H3Event): string | undefined {
  const target = getCookie(event, RETURN_COOKIE)
  if (target) deleteCookie(event, RETURN_COOKIE)
  // Single leading slash only — reject '//host' and '/\host', which browsers treat
  // as protocol-relative (external) URLs.
  return target && /^\/(?![/\\])/.test(target) ? target : undefined
}

export function oauthSuccessRedirect(event: H3Event, provider: string) {
  const target = takeReturnPath(event)
  if (target) return sendRedirect(event, withQuery(target, { linked: provider }))
  return sendRedirect(event, '/')
}

export function oauthCancelRedirect(event: H3Event) {
  return sendRedirect(event, takeReturnPath(event) ?? LOGIN_PATH)
}
