import { describe, expect, it } from 'vitest'
import { focusesClose, nextCamera, pickScanCamera } from '../../app/utils/barcode/camera'

describe('focusesClose', () => {
  it('accepts cameras that focus within 20 cm or do not report focus', () => {
    expect(focusesClose(0.1)).toBe(true)
    expect(focusesClose(0.2)).toBe(true)
    expect(focusesClose(undefined)).toBe(true)
  })

  it('rejects cameras that cannot focus within 20 cm', () => {
    expect(focusesClose(0.58)).toBe(false)
  })
})

describe('pickScanCamera', () => {
  it('prefers the main camera over a closer-focusing ultrawide and skips telephoto', () => {
    expect(
      pickScanCamera([
        { deviceId: 'tele', minFocusM: 0.58 },
        { deviceId: 'ultrawide', minFocusM: 0.04 },
        { deviceId: 'main', minFocusM: 0.1 }
      ])
    ).toBe('main')
  })

  it('ignores cameras that do not report a focus range', () => {
    expect(pickScanCamera([{ deviceId: 'unknown' }, { deviceId: 'main', minFocusM: 0.1 }])).toBe('main')
  })

  it('returns undefined when no camera focuses close', () => {
    expect(pickScanCamera([{ deviceId: 'tele', minFocusM: 0.58 }, { deviceId: 'unknown' }])).toBeUndefined()
  })
})

describe('nextCamera', () => {
  it('cycles to the following camera and wraps around', () => {
    expect(nextCamera(['a', 'b', 'c'], 'a')).toBe('b')
    expect(nextCamera(['a', 'b', 'c'], 'c')).toBe('a')
  })

  it('starts at the first camera when the current one is unknown', () => {
    expect(nextCamera(['a', 'b'], undefined)).toBe('a')
    expect(nextCamera(['a', 'b'], 'gone')).toBe('a')
  })

  it('returns undefined with no cameras', () => {
    expect(nextCamera([], 'a')).toBeUndefined()
  })
})
