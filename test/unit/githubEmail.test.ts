import { describe, expect, it } from 'vitest'
import { verifiedPrimaryEmail } from '../../server/utils/githubEmail'

describe('verifiedPrimaryEmail', () => {
  it('returns the primary email only when GitHub has verified it', () => {
    expect(
      verifiedPrimaryEmail([
        { email: 'public@example.com', primary: false, verified: true },
        { email: 'primary@example.com', primary: true, verified: true }
      ])
    ).toBe('primary@example.com')
    expect(verifiedPrimaryEmail([{ email: 'unverified@example.com', primary: true, verified: false }])).toBeNull()
    expect(verifiedPrimaryEmail([{ email: 'other@example.com', primary: false, verified: true }])).toBeNull()
    expect(verifiedPrimaryEmail([])).toBeNull()
  })
})
