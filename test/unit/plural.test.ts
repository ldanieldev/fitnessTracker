import { describe, expect, it } from 'vitest'
import { plural } from '../../app/utils/plural'

describe('plural', () => {
  it('adds an s for every count but one', () => {
    expect(plural(1, 'set')).toBe('1 set')
    expect(plural(0, 'set')).toBe('0 sets')
    expect(plural(3, 'exercise')).toBe('3 exercises')
  })
})
