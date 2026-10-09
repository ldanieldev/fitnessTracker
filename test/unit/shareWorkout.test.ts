import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareWorkout } from '../../app/utils/shareWorkout'

const named = (name: string) => Object.assign(new Error(name), { name })

describe('shareWorkout', () => {
  it('uses the share sheet when present', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    expect(await shareWorkout('t', { share })).toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: 't' })
  })

  it('treats a dismissed share sheet as cancelled, without copying', async () => {
    const writeText = vi.fn()
    expect(await shareWorkout('t', { share: vi.fn().mockRejectedValue(named('AbortError')), clipboard: { writeText } })).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('falls back to the clipboard when share is missing or refused', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    expect(await shareWorkout('t', { clipboard: { writeText } })).toBe('copied')
    expect(await shareWorkout('t', { share: vi.fn().mockRejectedValue(named('NotAllowedError')), clipboard: { writeText } })).toBe('copied')
  })

  it('falls back to manual copy when both are unavailable or refused', async () => {
    expect(await shareWorkout('t', {})).toBe('manual')
    expect(await shareWorkout('t', {
      share: vi.fn().mockRejectedValue(named('NotAllowedError')),
      clipboard: { writeText: vi.fn().mockRejectedValue(named('NotAllowedError')) }
    })).toBe('manual')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads the global navigator by default and falls back to manual when there is none', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    expect(await shareWorkout('t')).toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: 't' })
    vi.stubGlobal('navigator', undefined)
    expect(await shareWorkout('t')).toBe('manual')
  })
})
