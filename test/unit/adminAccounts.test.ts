import { drizzle } from 'drizzle-orm/node-postgres'
import { afterEach, describe, expect, it } from 'vitest'
import * as schema from '../../server/db/schema'
import { listAdminUsers } from '../../server/utils/admin/accounts'

const originalTz = process.env.TZ

function fakeDb(row: unknown[]) {
  const client = { query: async () => ({ rows: [row] }) }
  return drizzle({ client: client as never, schema })
}

describe('listAdminUsers', () => {
  afterEach(() => {
    process.env.TZ = originalTz
  })

  it('reads the zoneless last-used timestamp as UTC whatever the server timezone', async () => {
    process.env.TZ = 'America/Chicago'
    const db = fakeDb([1, 'Ann', 'ann@example.com', '2026-01-01 00:00:00', true, false, ['credentials'], '2',
      '2026-10-16 21:43:00.961'])

    const [user] = await listAdminUsers(db)

    expect(user!.tokenLastUsedAt?.toISOString()).toBe('2026-10-16T21:43:00.961Z')
    expect(user!.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(user!.tokenCount).toBe(2)
  })

  it('leaves a user with no tokens at null', async () => {
    const db = fakeDb([2, 'Bo', 'bo@example.com', '2026-01-01 00:00:00', null, false, null, null, null])

    const [user] = await listAdminUsers(db)

    expect(user!.tokenLastUsedAt).toBeNull()
    expect(user!.providers).toEqual([])
  })
})
