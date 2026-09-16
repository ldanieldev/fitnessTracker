import { describe, expect, it } from 'vitest'
import { getTableColumns, getTableName } from 'drizzle-orm'

describe('body schema', () => {
  it('declares the four measurement tables with the spec\'s columns', async () => {
    const schema = await import('../../server/db/schema')
    expect(getTableName(schema.measurementTypes)).toBe('measurement_types')
    expect(getTableName(schema.measurements)).toBe('measurements')
    expect(getTableName(schema.measurementGoals)).toBe('measurement_goals')
    expect(getTableName(schema.measurementTypePrefs)).toBe('measurement_type_prefs')

    expect(Object.keys(getTableColumns(schema.measurementTypes)).sort()).toEqual(
      ['createdAt', 'deletedAt', 'direction', 'id', 'key', 'name', 'precision', 'unit', 'updatedAt', 'userId']
    )
    expect(Object.keys(getTableColumns(schema.measurements)).sort()).toEqual(
      ['createdAt', 'id', 'measuredAt', 'measuredOn', 'typeId', 'updatedAt', 'userId', 'value']
    )
    expect(Object.keys(getTableColumns(schema.measurementGoals)).sort()).toEqual(
      ['createdAt', 'id', 'startDate', 'startValue', 'targetDate', 'targetValue', 'typeId', 'updatedAt', 'userId']
    )
    expect(Object.keys(getTableColumns(schema.measurementTypePrefs)).sort()).toEqual(['hidden', 'sortOrder', 'typeId', 'userId'])
  })

  it('seeds exactly the three built-ins with null user and stable keys', async () => {
    const { MEASUREMENT_TYPE_SEED } = await import('../../server/db/seed/body')
    expect(MEASUREMENT_TYPE_SEED.map((t) => t.key)).toEqual(['bodyweight', 'body_fat', 'waist'])
    for (const t of MEASUREMENT_TYPE_SEED) expect(t.userId).toBeNull()
  })
})
