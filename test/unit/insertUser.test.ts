import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>>, failures: [] as unknown[] }))

vi.mock('../../server/utils/db', () => ({
  db: {
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: () => {
          state.calls.push(values)
          const failure = state.failures.shift()
          return failure ? Promise.reject(failure) : Promise.resolve([{ id: 7, ...values }])
        }
      })
    })
  }
}))

const oneAdmin = Object.assign(new Error('dup'), { cause: { code: '23505', constraint: 'users_one_admin' } })
const dupEmail = Object.assign(new Error('dup'), { cause: { code: '23505', constraint: 'users_email_unique' } })
const values = { email: 'a@example.com', name: 'A', age: 30, isActive: true }

beforeEach(() => {
  state.calls = []
  state.failures = []
})

describe('insertUser', () => {
  it('asks the database whether this is the first user', async () => {
    const { insertUser } = await import('../../server/utils/insertUser')
    await insertUser(values)
    expect(state.calls).toHaveLength(1)
    expect(typeof state.calls[0]!.isAdmin).toBe('object')
  })
  it('retries as a normal user when it loses the first-admin race', async () => {
    const { insertUser } = await import('../../server/utils/insertUser')
    state.failures.push(oneAdmin)
    const row = await insertUser(values)
    expect(state.calls).toHaveLength(2)
    expect(state.calls[1]!.isAdmin).toBe(false)
    expect(row.id).toBe(7)
  })
  it('rethrows any other unique violation', async () => {
    const { insertUser } = await import('../../server/utils/insertUser')
    state.failures.push(dupEmail)
    await expect(insertUser(values)).rejects.toBe(dupEmail)
    expect(state.calls).toHaveLength(1)
  })
})
