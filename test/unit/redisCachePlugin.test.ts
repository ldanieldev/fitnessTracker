import { describe, expect, it, vi } from 'vitest'
import memoryDriver from 'unstorage/drivers/memory'
import type { Driver } from 'unstorage'
import { outageTracker, redisHost, redisRetryDelay, withFallback } from '../../server/utils/cache/redisFallback'

describe('withFallback', () => {
  it('serves from the primary while it is up and from the fallback while it is down', async () => {
    const primary = memoryDriver()
    const fallback = memoryDriver()
    let up = true
    const driver = withFallback(primary, fallback, () => up, vi.fn())

    await driver.setItem!('k', 'redis', {})
    expect(await primary.getItem('k', {})).toBe('redis')
    up = false
    expect(await driver.getItem('k', {})).toBeNull()
    await driver.setItem!('k', 'memory', {})
    expect(await fallback.getItem('k', {})).toBe('memory')
    up = true
    expect(await driver.getItem('k', {})).toBe('redis')
  })

  it('reports a failing command once per call and answers it from the fallback instead of throwing', async () => {
    const boom = new Error('Connection is closed.')
    const primary = { ...memoryDriver(), getItem: () => Promise.reject(boom) } as Driver
    const fallback = memoryDriver()
    await fallback.setItem!('k', 'kept', {})
    const onError = vi.fn()
    const driver = withFallback(primary, fallback, () => true, onError)

    await expect(driver.getItem('k', {})).resolves.toBe('kept')
    expect(onError).toHaveBeenCalledWith(boom)
  })

  it('keeps the redis name and instance the rate limiter looks for', () => {
    const instance = { status: 'ready' }
    const primary = { ...memoryDriver(), name: 'redis', getInstance: () => instance } as Driver
    const driver = withFallback(primary, memoryDriver(), () => true, vi.fn())
    expect(driver.name).toBe('redis')
    expect(driver.getInstance?.()).toBe(instance)
  })
})

describe('outageTracker', () => {
  it('warns once per outage and logs the recovery', () => {
    const log = { warn: vi.fn(), info: vi.fn() }
    const tracker = outageTracker('redis:6379', log)
    tracker.ready()
    expect(log.info).toHaveBeenLastCalledWith({ host: 'redis:6379' }, 'Redis cache mounted')
    for (let i = 0; i < 20; i++) tracker.lost()
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(log.warn).toHaveBeenCalledWith(
      { host: 'redis:6379' },
      'Redis cache unreachable; using the in-memory cache until it reconnects'
    )
    tracker.ready()
    expect(log.info).toHaveBeenLastCalledWith({ host: 'redis:6379' }, 'Redis cache reconnected')
    tracker.lost()
    expect(log.warn).toHaveBeenCalledTimes(2)
  })

  it('warns when Redis is unreachable from the start', () => {
    const log = { warn: vi.fn(), info: vi.fn() }
    const tracker = outageTracker('redis:6379', log)
    tracker.lost()
    tracker.lost()
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(log.info).not.toHaveBeenCalled()
  })

  it('logs failed commands at most once a minute', () => {
    const log = { warn: vi.fn(), info: vi.fn() }
    let clock = 0
    const tracker = outageTracker('redis:6379', log, () => clock)
    tracker.commandFailed(new Error('a'))
    clock = 30_000
    tracker.commandFailed(new Error('b'))
    clock = 61_000
    tracker.commandFailed(new Error('c'))
    expect(log.warn).toHaveBeenCalledTimes(2)
    expect(log.warn).toHaveBeenLastCalledWith(
      { err: new Error('c'), host: 'redis:6379' },
      'Redis cache command failed; served from the in-memory cache'
    )
  })
})

describe('redis helpers', () => {
  it('backs off reconnects up to a 5 s cap', () => {
    expect([1, 2, 4, 20, 1000].map(redisRetryDelay)).toEqual([250, 500, 1000, 5000, 5000])
  })

  it('names the host of a url and falls back to the raw string', () => {
    expect(redisHost('redis://:secret@redis:6379/0')).toBe('redis:6379')
    expect(redisHost('not-a-url')).toBe('not-a-url')
  })
})
