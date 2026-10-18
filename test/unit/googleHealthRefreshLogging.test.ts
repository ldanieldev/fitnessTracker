import { FetchError } from 'ofetch'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const log = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
vi.mock('../../server/utils/logger', () => ({ logger: log }))
vi.mock('../../server/utils/googleHealth/config', () => ({
  googleHealthConfig: () => ({ clientId: 'client', clientSecret: 'client-secret', tokenUrl: 'https://token' })
}))

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

const { refreshAccessToken, GoogleAuthError } = await import('../../server/utils/googleHealth/api')

function fetchError(status: number, data: unknown) {
  const error = new FetchError(`[POST] "https://token": ${status}`)
  Object.defineProperty(error, 'statusCode', { get: () => status })
  Object.defineProperty(error, 'data', { get: () => data })
  return error
}

beforeEach(() => vi.clearAllMocks())

describe('refreshAccessToken logging', () => {
  it('warns with only the user id when Google rejects the grant', async () => {
    fetchMock.mockRejectedValueOnce(fetchError(400, { error: 'invalid_grant' }))
    await expect(refreshAccessToken('refresh-secret', 7)).rejects.toBeInstanceOf(GoogleAuthError)
    expect(log.warn).toHaveBeenCalledWith({ userId: 7 }, 'Google Health refresh token rejected; reconnect required')
    expect(log.error).not.toHaveBeenCalled()
  })

  it('errors with the OAuth error and status, never the request, on any other failure', async () => {
    const error = fetchError(401, { error: 'invalid_client', error_description: 'x' })
    fetchMock.mockRejectedValueOnce(error)
    await expect(refreshAccessToken('refresh-secret', 7)).rejects.toBe(error)
    expect(log.error).toHaveBeenCalledWith(
      { err: error, userId: 7, oauthError: 'invalid_client', status: 401 },
      'Google Health token refresh failed'
    )
    expect(JSON.stringify(log.error.mock.calls)).not.toMatch(/refresh-secret|client-secret/)
  })
})
