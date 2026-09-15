import { describe, expect, it } from 'vitest'
import { getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'

describe('diary schema invariants', () => {
  it('stores the diary date as a date column with no timezone', async () => {
    const { diaryDays } = await import('../../server/db/schema/nutrition/diary')
    const col = getTableConfig(diaryDays).columns.find((c) => c.name === 'date')
    expect(col!.getSQLType()).toBe('date')
  })

  it('makes one day per user per date unique', async () => {
    const { diaryDays } = await import('../../server/db/schema/nutrition/diary')
    const u = getTableConfig(diaryDays).uniqueConstraints.find((c) => c.name === 'diary_day_user_date_unique')
    expect(u!.columns.map((c) => c.name)).toEqual(['user_id', 'date'])
  })

  it('restricts container deletion so history cannot be orphaned', async () => {
    const { diaryEntries } = await import('../../server/db/schema/nutrition/diary')
    const fk = getTableConfig(diaryEntries).foreignKeys.find((f) =>
      getTableName(f.reference().foreignTable) === 'meal_containers')
    expect(fk!.onDelete).toBe('restrict')
  })
})
