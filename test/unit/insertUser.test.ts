import { beforeEach, describe, expect, it } from 'vitest'
import type { DbTransaction } from '../../server/utils/db'
import { insertUser } from '../../server/utils/insertUser'

const state = { calls: [] as Array<{ values: Record<string, unknown>; savepoint: boolean }>, failures: [] as unknown[] }

function fakeTx(savepoint = false): DbTransaction {
  return {
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: () => {
          state.calls.push({ values, savepoint })
          const failure = state.failures.shift()
          return failure ? Promise.reject(failure) : Promise.resolve([{ id: 7, ...values }])
        }
      })
    }),
    transaction: (fn: (tx: DbTransaction) => Promise<unknown>) => fn(fakeTx(true))
  } as unknown as DbTransaction
}

const oneAdmin = Object.assign(new Error('dup'), { cause: { code: '23505', constraint: 'users_one_admin' } })
const dupEmail = Object.assign(new Error('dup'), { cause: { code: '23505', constraint: 'users_email_unique' } })
const values = { email: 'a@example.com', name: 'A', age: 30, isActive: true }

beforeEach(() => {
  state.calls = []
  state.failures = []
})

describe('insertUser', () => {
  it('asks the database whether this is the first user, inside a savepoint', async () => {
    await insertUser(fakeTx(), values)
    expect(state.calls).toHaveLength(1)
    expect(typeof state.calls[0]!.values.isAdmin).toBe('object')
    expect(state.calls[0]!.savepoint).toBe(true)
  })
  it('retries as a normal user when it loses the first-admin race', async () => {
    state.failures.push(oneAdmin)
    const row = await insertUser(fakeTx(), values)
    expect(state.calls).toHaveLength(2)
    expect(state.calls[1]!.values.isAdmin).toBe(false)
    expect(state.calls[1]!.savepoint).toBe(false)
    expect(row.id).toBe(7)
  })
  it('rethrows any other unique violation', async () => {
    state.failures.push(dupEmail)
    await expect(insertUser(fakeTx(), values)).rejects.toBe(dupEmail)
    expect(state.calls).toHaveLength(1)
  })
})
