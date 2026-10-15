import { describe, expect, it } from 'vitest'
import { sessionRejected } from '../../server/utils/sessionEpoch'

describe('sessionRejected', () => {
  it('accepts a matching epoch on an active user', () => {
    expect(sessionRejected({ isActive: true, sessionEpoch: 3 }, 3)).toBe(false)
  })
  it('treats a session without an epoch as epoch 0', () => {
    expect(sessionRejected({ isActive: true, sessionEpoch: 0 }, undefined)).toBe(false)
    expect(sessionRejected({ isActive: true, sessionEpoch: 1 }, undefined)).toBe(true)
  })
  it('rejects a stale epoch, a disabled user and a missing row', () => {
    expect(sessionRejected({ isActive: true, sessionEpoch: 4 }, 3)).toBe(true)
    expect(sessionRejected({ isActive: false, sessionEpoch: 3 }, 3)).toBe(true)
    expect(sessionRejected(undefined, 3)).toBe(true)
  })
  it('treats a null isActive as active', () => {
    expect(sessionRejected({ isActive: null, sessionEpoch: 0 }, 0)).toBe(false)
  })
})
