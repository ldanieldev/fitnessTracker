import { afterEach, describe, expect, it, vi } from 'vitest'

const pg = vi.hoisted(() => ({ connections: 0, failOn: new Set<string>() }))

vi.mock('pg', () => ({
  Client: class {
    async connect() {
      pg.connections++
    }

    async query(sql: string) {
      if (pg.failOn.has(sql)) throw new Error(`${sql} failed`)
      if (sql !== 'begin' && sql !== 'commit' && sql !== 'rollback' && pg.failOn.has('statement')) {
        throw new Error('statement failed')
      }
    }

    async end() {}
  }
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  pg.connections = 0
  pg.failOn.clear()
})

describe('exercises:reimport', () => {
  it('refuses to run without DATABASE_URL instead of falling back to PG* defaults', async () => {
    vi.stubEnv('DATABASE_URL', '')
    await expect(import('../../scripts/exercises/reimport')).rejects.toThrow('DATABASE_URL is not set')
    expect(pg.connections).toBe(0)
  })

  it('surfaces the failing statement, not a failed rollback', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://example.invalid/db')
    pg.failOn.add('statement')
    pg.failOn.add('rollback')
    await expect(import('../../scripts/exercises/reimport')).rejects.toThrow('statement failed')
  })
})
