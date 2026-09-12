import { describe, expect, it, vi } from 'vitest'
import { resolveRedisCache } from '../../server/utils/cache/redisMount'

describe('resolveRedisCache', () => {
  it('returns memory without probing when the url is unset', async () => {
    const probe = vi.fn()
    const log = vi.fn()
    await expect(resolveRedisCache(undefined, probe, log)).resolves.toBe('memory')
    expect(probe).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  it('returns memory and logs once when the probe rejects', async () => {
    const probe = vi.fn().mockRejectedValue(new Error('timeout'))
    const log = vi.fn()
    await expect(resolveRedisCache('redis://redis:6379', probe, log)).resolves.toBe('memory')
    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith('[cache] Redis unreachable at redis:6379; using the in-memory cache')
  })

  it('returns redis when the probe resolves', async () => {
    const probe = vi.fn().mockResolvedValue(undefined)
    const log = vi.fn()
    await expect(resolveRedisCache('redis://localhost:6379', probe, log)).resolves.toBe('redis')
    expect(log).not.toHaveBeenCalled()
  })

  it('returns memory and logs once when the probe throws synchronously (e.g. a malformed URL), never rejecting', async () => {
    const probe = vi.fn(() => {
      throw new Error('Invalid URL')
    })
    const log = vi.fn()
    await expect(resolveRedisCache('not-a-url', probe, log)).resolves.toBe('memory')
    expect(log).toHaveBeenCalledTimes(1)
  })
})
