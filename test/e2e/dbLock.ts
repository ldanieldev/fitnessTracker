import { Client } from 'pg'
import { expect } from '@playwright/test'

export interface HeldLocks {
  client: Client
  queued: () => Promise<number>
  waitForBlocked: (count: number) => Promise<void>
  release: (options?: { rollback?: boolean }) => Promise<void>
}

// Runs the statement in an open transaction on its own connection so a request can be made to queue behind its row locks.
export async function holdLocks(text: string, values: unknown[]): Promise<HeldLocks> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  let pid: number
  try {
    await client.query('begin')
    await client.query(text, values)
    pid = (await client.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0]!.pid
  } catch (err) {
    await client.end()
    throw err
  }
  // Transitive: a second waiter on the same row queues behind the first waiter, not behind this connection.
  const queued = async () => (await client.query<{ n: number }>(`
    with recursive waiting(pid) as (
      select pid from pg_locks where not granted and $1 = any(pg_blocking_pids(pid))
      union
      select l.pid from pg_locks l join waiting w on w.pid = any(pg_blocking_pids(l.pid)) where not l.granted
    )
    select count(distinct pid)::int as n from waiting
  `, [pid])).rows[0]!.n
  return {
    client,
    queued,
    async waitForBlocked(count) {
      // pg_locks is read live; pg_stat_activity would stay frozen at its first read inside this transaction.
      await expect.poll(queued).toBeGreaterThanOrEqual(count)
    },
    async release({ rollback = false } = {}) {
      try {
        await client.query(rollback ? 'rollback' : 'commit')
      } finally {
        await client.end()
      }
    }
  }
}
