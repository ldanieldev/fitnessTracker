import { beforeEach, describe, expect, it, vi } from 'vitest'

const log = vi.hoisted(() => {
  const l = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => l }
  return l
})
vi.mock('../../server/utils/logger', () => ({ logger: log }))
vi.mock('../../server/utils/inngest/client', () => ({ inngest: { send: vi.fn() } }))
vi.mock('../../server/utils/db', () => ({ db: {} }))

const order: string[] = []
const updates: Array<() => Promise<unknown[]>> = []

function update() {
  const chain = {
    set: () => chain,
    where: () => chain,
    returning: () => chain,
    then<A, B = never>(onfulfilled?: (value: unknown[]) => A, onrejected?: (reason: unknown) => B) {
      order.push('update')
      return updates.shift()!().then(onfulfilled, onrejected)
    }
  }
  return chain
}

const fakeDb = { update }

beforeEach(() => {
  vi.clearAllMocks()
  order.length = 0
  updates.length = 0
  log.error.mockImplementation(() => order.push('log.error'))
})

describe('runMyMacrosImport failure logging', () => {
  it('logs the failure before the status update and rethrows the original error when that update fails', async () => {
    const { runMyMacrosImport } = await import('../../server/utils/nutrition/mymacros/run')
    const { wasReported } = await import('../../server/utils/inngest/reported')
    updates.push(
      async () => [{ id: 42, userId: 7, payload: null }],
      async () => {
        throw new Error('db down')
      }
    )

    const thrown = await runMyMacrosImport(fakeDb as never, 42, 7).catch((err: unknown) => err)

    expect(thrown).toBeInstanceOf(TypeError)
    expect(wasReported(thrown)).toBe(true)
    expect(order).toEqual(['update', 'log.error', 'update', 'log.error'])
    expect(log.error.mock.calls[0]).toEqual([
      { err: thrown, jobId: 42, userId: 7, source: 'mymacros' },
      'import job failed'
    ])
    expect(log.error.mock.calls[1]![0]).toMatchObject({ jobId: 42, source: 'mymacros' })
  })

  it('warns and marks the error reported when the job cannot be claimed', async () => {
    const { runMyMacrosImport } = await import('../../server/utils/nutrition/mymacros/run')
    const { wasReported } = await import('../../server/utils/inngest/reported')
    updates.push(async () => [])

    const thrown = await runMyMacrosImport(fakeDb as never, 42, 7).catch((err: unknown) => err)

    expect(wasReported(thrown)).toBe(true)
    expect(log.warn).toHaveBeenCalledWith(
      { jobId: 42, userId: 7, source: 'mymacros' },
      'import job not claimed: not a queued job for this user'
    )
  })
})
