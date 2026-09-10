import { describe, expect, it, vi, beforeEach } from 'vitest'

const send = vi.fn()

vi.mock('~~/server/utils/inngest/client', () => ({ inngest: { send: (...args: unknown[]) => send(...args) } }))

function fakeDb() {
  const set = vi.fn(() => ({ where }))
  const where = vi.fn(async () => undefined)
  const update = vi.fn(() => ({ set }))
  return { update, set, where }
}

describe('queueImportJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends the requested event with the job and user ids', async () => {
    const { queueImportJob } = await import('../../server/utils/nutrition/mymacros/queue')
    const db = fakeDb()

    await queueImportJob(db as never, 42, 7)

    expect(send).toHaveBeenCalledWith({ name: 'import/mymacros.requested', data: { jobId: 42, userId: 7 } })
    expect(db.update).not.toHaveBeenCalled()
  })

  it('marks the job failed and rethrows when the send fails', async () => {
    const { queueImportJob } = await import('../../server/utils/nutrition/mymacros/queue')
    const db = fakeDb()
    send.mockRejectedValueOnce(new Error('runner unreachable'))

    await expect(queueImportJob(db as never, 42, 7)).rejects.toThrow('runner unreachable')

    expect(db.update).toHaveBeenCalledTimes(1)
    expect(db.set).toHaveBeenCalledWith({ status: 'failed', error: 'Could not queue the import job: runner unreachable' })
    expect(db.where).toHaveBeenCalledTimes(1)
  })
})
