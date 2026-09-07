import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loginError, oauthSuccessRedirect } from '../../server/utils/oauthRedirect'

// oauthRedirect.ts uses auto-imported h3 helpers; stubGlobal so unstubAllGlobals() restores them after each test.
const sendRedirect = vi.fn((_event: unknown, url: string) => url)
let cookies: Map<string, string>
const getCookie = vi.fn((_event: unknown, name: string) => cookies.get(name))
const deleteCookie = vi.fn((_event: unknown, name: string) => {
  cookies.delete(name)
})

const event = {} as never // the stubs ignore it

beforeEach(() => {
  cookies = new Map()
  vi.clearAllMocks()
  vi.stubGlobal('sendRedirect', sendRedirect)
  vi.stubGlobal('getCookie', getCookie)
  vi.stubGlobal('deleteCookie', deleteCookie)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loginError', () => {
  it('redirects to the login page carrying the error code', () => {
    expect(loginError(event, 'no_email')).toBe('/auth/login?error=no_email')
    expect(loginError(event, 'already_linked')).toBe('/auth/login?error=already_linked')
  })
})

describe('oauthSuccessRedirect', () => {
  it('defaults to "/" when no return cookie is set (the login flow)', () => {
    expect(oauthSuccessRedirect(event, 'google')).toBe('/')
  })

  it('returns to the stashed path and flags the linked provider', () => {
    cookies.set('oauth-redirect', '/settings/security')
    expect(oauthSuccessRedirect(event, 'google')).toBe('/settings/security?linked=google')
  })

  it('merges the flag into a path that already has a query string', () => {
    cookies.set('oauth-redirect', '/settings/security?tab=accounts')
    expect(oauthSuccessRedirect(event, 'github')).toBe('/settings/security?tab=accounts&linked=github')
  })

  it('reads and then clears the return cookie', () => {
    cookies.set('oauth-redirect', '/settings/security')
    oauthSuccessRedirect(event, 'google')
    expect(deleteCookie).toHaveBeenCalledWith(event, 'oauth-redirect')
    expect(cookies.has('oauth-redirect')).toBe(false)
  })

  it.each([
    ['//evil.com', 'protocol-relative'],
    ['/\\evil.com', 'backslash protocol-relative'],
    ['https://evil.com', 'absolute url'],
    ['javascript:alert(1)', 'js scheme'],
    ['', 'empty']
  ])('refuses to redirect to %s (%s) and falls back to "/"', (target) => {
    cookies.set('oauth-redirect', target)
    expect(oauthSuccessRedirect(event, 'google')).toBe('/')
  })

  it('still clears the cookie even when the target is rejected', () => {
    cookies.set('oauth-redirect', '//evil.com')
    oauthSuccessRedirect(event, 'google')
    expect(cookies.has('oauth-redirect')).toBe(false)
  })
})
