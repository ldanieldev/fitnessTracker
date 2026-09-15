import { describe, expect, it } from 'vitest'

describe('escapeLike', () => {
  it('escapes a percent sign', async () => {
    const { escapeLike } = await import('../../server/utils/nutrition/postgresSearch')
    expect(escapeLike('50%')).toBe('50\\%')
  })

  it('escapes an underscore', async () => {
    const { escapeLike } = await import('../../server/utils/nutrition/postgresSearch')
    expect(escapeLike('a_b')).toBe('a\\_b')
  })

  it('escapes a trailing backslash', async () => {
    const { escapeLike } = await import('../../server/utils/nutrition/postgresSearch')
    expect(escapeLike('a\\')).toBe('a' + '\\\\')
  })

  it('escapes a backslash before a wildcard', async () => {
    const { escapeLike } = await import('../../server/utils/nutrition/postgresSearch')
    expect(escapeLike('\\%')).toBe('\\\\' + '\\%')
  })

  it('leaves plain text unchanged', async () => {
    const { escapeLike } = await import('../../server/utils/nutrition/postgresSearch')
    expect(escapeLike('chick')).toBe('chick')
  })
})
