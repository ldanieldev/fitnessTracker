import { describe, expect, it } from 'vitest'
import {
  bodyLimitFor,
  csrfRejection,
  declaredLengthTooLarge,
  DEFAULT_BODY_LIMIT,
  pathOnly
} from '../../server/utils/requestGuards/rules'
import { FITNOTES_MAX_BYTES } from '../../server/utils/workouts/fitnotes/input'

describe('pathOnly', () => {
  it('drops the query, fragment and trailing slash', () => {
    expect(pathOnly('/api/inngest?fnId=x&stepId=y')).toBe('/api/inngest')
    expect(pathOnly('/api/workouts/import/fitnotes/')).toBe('/api/workouts/import/fitnotes')
    expect(pathOnly('/#x')).toBe('/')
  })
})

describe('bodyLimitFor', () => {
  it('defaults to 1 MiB', () => {
    expect(DEFAULT_BODY_LIMIT).toBe(1024 * 1024)
    expect(bodyLimitFor('/api/auth/login')).toBe(DEFAULT_BODY_LIMIT)
  })

  it('lets the import routes carry their own caps plus encoding overhead', () => {
    expect(bodyLimitFor('/api/workouts/import/fitnotes')).toBe(2 * FITNOTES_MAX_BYTES)
    expect(bodyLimitFor('/api/workouts/import/fitnotes/preview?x=1')).toBe(2 * FITNOTES_MAX_BYTES)
    expect(bodyLimitFor('/api/nutrition/import/mymacros')).toBe(3 * 1024 * 1024)
    expect(bodyLimitFor('/api/workouts/programs/import')).toBe(4 * 1024 * 1024)
    expect(bodyLimitFor('/api/inngest?fnId=a')).toBeGreaterThan(DEFAULT_BODY_LIMIT)
  })

  it('does not extend a larger limit to look-alike paths', () => {
    expect(bodyLimitFor('/api/workouts/import/fitnotes/123')).toBe(DEFAULT_BODY_LIMIT)
  })
})

describe('declaredLengthTooLarge', () => {
  it('compares the declared length to the limit', () => {
    expect(declaredLengthTooLarge('1048576', 1048576)).toBe(false)
    expect(declaredLengthTooLarge('1048577', 1048576)).toBe(true)
  })

  it('treats an unparseable length as too large', () => {
    expect(declaredLengthTooLarge('abc', 1048576)).toBe(true)
  })
})

describe('csrfRejection', () => {
  const post = { method: 'POST', path: '/api/auth/login', host: 'fit.example.com' }

  it('ignores safe methods', () => {
    expect(csrfRejection({ ...post, method: 'GET', secFetchSite: 'cross-site' })).toBeNull()
  })

  it('allows same-origin and user-initiated requests', () => {
    expect(csrfRejection({ ...post, secFetchSite: 'same-origin', origin: 'https://fit.example.com' })).toBeNull()
    expect(csrfRejection({ ...post, secFetchSite: 'none' })).toBeNull()
  })

  it('rejects cross-site and same-site (sibling subdomain) requests', () => {
    expect(csrfRejection({ ...post, secFetchSite: 'cross-site' })).not.toBeNull()
    expect(csrfRejection({ ...post, method: 'DELETE', secFetchSite: 'same-site' })).not.toBeNull()
  })

  it('falls back to Origin vs Host when Sec-Fetch-Site is absent', () => {
    expect(csrfRejection({ ...post, origin: 'https://fit.example.com' })).toBeNull()
    expect(csrfRejection({ ...post, origin: 'https://evil.example.com' })).not.toBeNull()
    expect(csrfRejection({ ...post, origin: 'null' })).not.toBeNull()
    expect(csrfRejection({ ...post, origin: 'https://fit.example.com', host: undefined })).not.toBeNull()
  })

  it('compares the port as part of the host', () => {
    const local = { ...post, host: 'localhost:3000' }
    expect(csrfRejection({ ...local, origin: 'http://localhost:3000' })).toBeNull()
    expect(csrfRejection({ ...local, origin: 'http://localhost:4000' })).not.toBeNull()
  })

  it('lets non-browser clients without Origin or Sec-Fetch-Site through', () => {
    expect(csrfRejection(post)).toBeNull()
  })

  it('skips token-authenticated requests and the signed Inngest endpoint', () => {
    expect(csrfRejection({ ...post, authorization: 'Bearer mfj_x', secFetchSite: 'cross-site' })).toBeNull()
    expect(csrfRejection({ ...post, path: '/api/inngest?fnId=a', secFetchSite: 'cross-site' })).toBeNull()
  })
})
