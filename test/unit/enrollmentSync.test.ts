import { describe, expect, it } from 'vitest'
import { getTableName, type Table } from 'drizzle-orm'
import type { DbClient } from '../../server/utils/db'

function fakeClient(rows: unknown[] = []) {
  const reads: string[] = []
  const locks: [string, string][] = []
  const query = (table: Table) => {
    reads.push(getTableName(table))
    const lockable = {
      for: (strength: string) => {
        locks.push([getTableName(table), strength])
        return Promise.resolve(rows)
      }
    }
    return Object.assign(Promise.resolve(rows), lockable, { orderBy: () => lockable })
  }
  const client = { select: () => ({ from: (table: Table) => ({ where: () => query(table) }) }) } as unknown as DbClient
  return { client, reads, locks }
}

describe('enrollment row lock', () => {
  it('liveEnrollment reads without a lock by default', async () => {
    const { liveEnrollment } = await import('../../server/utils/workouts/enrollments')
    const { client, reads, locks } = fakeClient()
    expect(await liveEnrollment(client, 1)).toBeUndefined()
    expect(reads).toEqual(['user_program_enrollments'])
    expect(locks).toEqual([])
  })

  it('syncEnrollment locks every routine, then the live row, FOR NO KEY UPDATE before deciding anything', async () => {
    const { syncEnrollment } = await import('../../server/utils/workouts/enrollments')
    const { client, locks } = fakeClient()
    await syncEnrollment(client, 1, '2026-01-05')
    expect(locks).toEqual([
      ['routines', 'no key update'],
      ['user_program_enrollments', 'no key update']
    ])
  })
})
