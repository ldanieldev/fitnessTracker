import { describe, expect, it } from 'vitest'
import { configuredOAuthProviders } from '../../shared/utils/oauthProviders'

const set = { clientId: 'id', clientSecret: 'secret' }
const unset = { clientId: '', clientSecret: '' }

describe('configuredOAuthProviders', () => {
  it('lists every provider with both a client id and secret, Google first', () => {
    expect(configuredOAuthProviders({ github: set, google: set })).toEqual(['google', 'github'])
  })

  it('leaves out a provider missing its secret', () => {
    expect(configuredOAuthProviders({ google: set, github: { clientId: 'id', clientSecret: '' } })).toEqual(['google'])
  })

  it('is empty when nothing is configured', () => {
    expect(configuredOAuthProviders({ google: unset, github: unset })).toEqual([])
  })
})
