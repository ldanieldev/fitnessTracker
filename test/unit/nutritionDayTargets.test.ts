import { describe, expect, it } from 'vitest'
import { resolveDayTargets } from '../../server/utils/nutrition/day'

describe('resolveDayTargets', () => {
  it('follows the current default when the day has no applied profile', () => {
    expect(resolveDayTargets(null, 'snapshot', 'default')).toBe('default')
  })

  it('keeps the snapshot when the day has an explicitly applied profile', () => {
    expect(resolveDayTargets(7, 'snapshot', 'default')).toBe('snapshot')
  })
})
