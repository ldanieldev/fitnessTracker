import { describe, expect, it } from 'vitest'
import { getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'

describe('food servings schema invariants', () => {
  it('keys food nutrients on the serving, not the food', async () => {
    const { foodNutrients } = await import('../../server/db/schema/nutrition/food')
    const cols = getTableConfig(foodNutrients).columns.map((c) => c.name)
    expect(cols).toContain('food_serving_id')
    expect(cols).not.toContain('food_id')
  })

  it('allows at most one weight serving per food', async () => {
    const { foodServings } = await import('../../server/db/schema/nutrition/food')
    const idx = getTableConfig(foodServings).indexes.find((i) => i.config.name === 'food_one_weight_serving')
    expect(idx).toBeDefined()
    expect(idx!.config.unique).toBe(true)
    expect(idx!.config.where).toBeDefined()
  })

  it('requires a serving to own nutrition or carry a gram basis', async () => {
    const { foodServings } = await import('../../server/db/schema/nutrition/food')
    const names = getTableConfig(foodServings).checks.map((c) => c.name)
    expect(names).toContain('serving_has_basis')
    expect(names).toContain('weight_serving_owns_nutrition')
    expect(names).toContain('serving_basis_grams_positive')
  })

  it('scopes catalog barcode uniqueness to non-deleted catalog rows', async () => {
    const { foods } = await import('../../server/db/schema/nutrition/food')
    const idx = getTableConfig(foods).indexes.find((i) => i.config.name === 'food_catalog_barcode_unique')
    expect(idx).toBeDefined()
    expect(idx!.config.unique).toBe(true)
    expect(idx!.config.where).toBeDefined()
  })
})

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

  it('snapshots a direction alongside every day target', async () => {
    const { diaryDayTargets } = await import('../../server/db/schema/nutrition/diary')
    expect(getTableConfig(diaryDayTargets).columns.map((c) => c.name)).toContain('direction')
  })

  it('carries an editable logged_at and display snapshots on entries', async () => {
    const { diaryEntries } = await import('../../server/db/schema/nutrition/diary')
    const cols = getTableConfig(diaryEntries).columns.map((c) => c.name)
    expect(cols).toEqual(expect.arrayContaining([
      'logged_at', 'unit_label', 'description', 'brand_snapshot', 'ingredient_snapshot'
    ]))
  })

  it('restricts container deletion so history cannot be orphaned', async () => {
    const { diaryEntries } = await import('../../server/db/schema/nutrition/diary')
    const fk = getTableConfig(diaryEntries).foreignKeys.find((f) =>
      getTableName(f.reference().foreignTable) === 'meal_containers')
    expect(fk!.onDelete).toBe('restrict')
  })
})

describe('recipe and goal schema invariants', () => {
  it('rejects a recipe with zero servings at the database level', async () => {
    const { recipes } = await import('../../server/db/schema/nutrition/recipe')
    expect(getTableConfig(recipes).checks.map((c) => c.name)).toContain('recipe_servings_positive')
  })

  it('reserves finished_weight_g with no v1 use', async () => {
    const { recipes } = await import('../../server/db/schema/nutrition/recipe')
    const col = getTableConfig(recipes).columns.find((c) => c.name === 'finished_weight_g')
    expect(col!.notNull).toBe(false)
  })

  it('pins both the typed unit and the resolved grams on a recipe ingredient', async () => {
    const { recipeIngredients } = await import('../../server/db/schema/nutrition/recipe')
    const cols = getTableConfig(recipeIngredients).columns.map((c) => c.name)
    expect(cols).toEqual(expect.arrayContaining(['food_serving_id', 'quantity', 'unit_label', 'grams_resolved']))
  })

  it('keeps ratio_percent alongside the resolved amount on goal targets', async () => {
    const { goalProfileTargets } = await import('../../server/db/schema/nutrition/goal')
    const cols = getTableConfig(goalProfileTargets).columns.map((c) => c.name)
    expect(cols).toEqual(expect.arrayContaining(['amount', 'direction', 'ratio_percent']))
  })

  it('indexes the search outbox on unprocessed rows only', async () => {
    const { searchOutbox } = await import('../../server/db/schema/nutrition/goal')
    const idx = getTableConfig(searchOutbox).indexes.find((i) => i.config.name === 'search_outbox_pending')
    expect(idx!.config.where).toBeDefined()
  })

  it('indexes diary entries by day, container and sort order', async () => {
    const { diaryEntries } = await import('../../server/db/schema/nutrition/diary')
    const idx = getTableConfig(diaryEntries).indexes.find((i) => i.config.name === 'diary_entry_day_container_order')
    expect(idx!.config.columns.map((c) => (c as { name: string }).name))
      .toEqual(['day_id', 'container_id', 'sort_order'])
  })

  it('indexes foods by owner and soft-delete state', async () => {
    const { foods } = await import('../../server/db/schema/nutrition/food')
    const idx = getTableConfig(foods).indexes.find((i) => i.config.name === 'food_owner_live')
    expect(idx!.config.columns.map((c) => (c as { name: string }).name))
      .toEqual(['created_by_user_id', 'deleted_at'])
  })

  it('allows only one live default goal profile per user', async () => {
    const { goalProfiles } = await import('../../server/db/schema/nutrition/goal')
    const idx = getTableConfig(goalProfiles).indexes.find((i) => i.config.name === 'goal_profile_one_default')
    expect(idx).toBeDefined()
    expect(idx!.config.unique).toBe(true)
    expect(idx!.config.where).toBeDefined()
  })
})
