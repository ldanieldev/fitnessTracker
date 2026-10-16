import { describe, expect, it } from 'vitest'
import { inngestProductionProblems } from '../../server/utils/inngest/productionGuard'

const strong = { INNGEST_SIGNING_KEY: 'a'.repeat(64), INNGEST_EVENT_KEY: 'b'.repeat(64) }

describe('inngestProductionProblems', () => {
  it('passes random keys with dev mode unset, empty or explicitly off', () => {
    expect(inngestProductionProblems(strong)).toEqual([])
    expect(inngestProductionProblems({ ...strong, INNGEST_DEV: '' })).toEqual([])
    expect(inngestProductionProblems({ ...strong, INNGEST_DEV: '0' })).toEqual([])
    expect(inngestProductionProblems({ ...strong, INNGEST_DEV: 'false' })).toEqual([])
  })

  it.each(['1', 'true', 'http://localhost:8288'])('refuses INNGEST_DEV=%s', (value) => {
    expect(inngestProductionProblems({ ...strong, INNGEST_DEV: value })).toEqual([
      'INNGEST_DEV is set, which turns off Inngest request signing'
    ])
  })

  it('refuses missing keys', () => {
    expect(inngestProductionProblems({})).toEqual([
      'INNGEST_SIGNING_KEY is not set',
      'INNGEST_EVENT_KEY is not set'
    ])
  })

  it('refuses the compose defaults, with or without a signkey prefix', () => {
    const env = { INNGEST_SIGNING_KEY: 'signkey-prod-cafebabecafebabe', INNGEST_EVENT_KEY: 'deadbeefdeadbeef' }
    expect(inngestProductionProblems(env)).toEqual([
      'INNGEST_SIGNING_KEY is the compose.yml default',
      'INNGEST_EVENT_KEY is the compose.yml default'
    ])
  })

  it('refuses short keys and accepts a prefixed long one', () => {
    expect(inngestProductionProblems({ ...strong, INNGEST_EVENT_KEY: 'abcd1234' })).toEqual([
      'INNGEST_EVENT_KEY is shorter than 32 characters'
    ])
    expect(inngestProductionProblems({ ...strong, INNGEST_SIGNING_KEY: `signkey-prod-${'c'.repeat(64)}` })).toEqual([])
  })
})
