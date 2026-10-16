import { describe, expect, it } from 'vitest'
import { leavesNoSignIn } from '../../server/utils/unlinkProvider'

describe('leavesNoSignIn', () => {
  it('blocks unlinking the only provider', () => {
    expect(leavesNoSignIn(['credentials'], 'credentials')).toBe(true)
  })
  it('blocks unlinking a provider linked twice when nothing else remains', () => {
    expect(leavesNoSignIn(['github', 'github'], 'github')).toBe(true)
  })
  it('allows unlinking when another provider remains', () => {
    expect(leavesNoSignIn(['github', 'github', 'google'], 'github')).toBe(false)
  })
  it('allows unlinking credentials when an OAuth provider remains', () => {
    expect(leavesNoSignIn(['credentials', 'google'], 'credentials')).toBe(false)
  })
})
