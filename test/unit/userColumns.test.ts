import { describe, expect, it } from 'vitest'
import { publicUserColumns } from '../../server/utils/userColumns'

describe('publicUserColumns', () => {
  it('omits password and sessionEpoch but keeps isAdmin', () => {
    expect(publicUserColumns).not.toHaveProperty('password')
    expect(publicUserColumns).not.toHaveProperty('sessionEpoch')
    expect(publicUserColumns).toHaveProperty('isAdmin')
  })
})
