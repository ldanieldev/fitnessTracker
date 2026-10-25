import { readFileSync } from 'node:fs'
import { expect, test } from '@nuxt/test-utils/playwright'
import { sql, type SQL } from 'drizzle-orm'
import { withAdminDb } from './adminDb'
import { apiFetch, makeUser, registerViaApi, seedCatalogFood } from './helpers'

const statements = readFileSync(new URL('../../drizzle/0023_calculated_energy.sql', import.meta.url), 'utf8')
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean)

const ROLLBACK = new Error('rollback the migration test')

interface DayEntry {
  id: number
  entryType: string
}

type SnapshotItem = { nutrients?: Record<string, number> } & Record<string, unknown>

const idList = (ids: number[]) => sql.join(ids.map((i) => sql`${i}`), sql`, `)

test('migration 0023 recalculates stored energy from P/C/F and is idempotent', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Calc Food',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10, carbohydrate: 20, fat: 5 } }]
  })
  const foodId = food.json.id
  const oil = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Calc Oil',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { fat: 100 } }]
  })
  const catalogue = await seedCatalogFood(page, {
    name: 'Calc Catalogue Food',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 2, carbohydrate: 3, fat: 1 } }]
  })
  const recipe = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Calc Recipe',
    servings: 1,
    servingName: 'Portion',
    ingredients: [
      { foodId, quantity: 100, unitLabel: 'g' },
      { foodId: oil.json.id, quantity: 10, unitLabel: 'g' }
    ]
  })

  const oldDay = '2026-10-23'
  const newDay = '2026-10-24'
  await apiFetch(page, 'POST', `/api/nutrition/diary/${oldDay}/entries`, [
    { entryType: 'food', foodId, containerId, quantity: 100, unitLabel: 'g' }
  ])
  await apiFetch(page, 'POST', `/api/nutrition/diary/${newDay}/entries`, [
    { entryType: 'food', foodId, containerId, quantity: 100, unitLabel: 'g' },
    { entryType: 'recipe', recipeId: recipe.json.id, containerId, quantity: 1, unitLabel: 'Portion' },
    {
      entryType: 'quick_add',
      containerId,
      description: 'Quick',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { energy: 300, protein: 10, carbohydrate: 10, fat: 10 }
    }
  ])

  const day = async (date: string) =>
    (await apiFetch<{ entries: DayEntry[] }>(page, 'GET', `/api/nutrition/diary/${date}`)).json.entries
  const oldEntry = (await day(oldDay))[0]!
  const newEntries = await day(newDay)
  const foodEntry = newEntries.find((e) => e.entryType === 'food')!
  const recipeEntry = newEntries.find((e) => e.entryType === 'recipe')!
  const quickEntry = newEntries.find((e) => e.entryType === 'quick_add')!
  const ids = [oldEntry.id, foodEntry.id, recipeEntry.id, quickEntry.id]

  // The statements are global, so they run in a transaction that is always rolled back to leave the dev DB as it was.
  const outcome = await withAdminDb((db) =>
    db.transaction(async (tx) => {
      const rows = async (query: SQL) => (await tx.execute(query)).rows
      const energyOf = async (entryId: number) =>
        Number(
          (
            await rows(sql`
              SELECT den.amount::float AS amount FROM app.diary_entry_nutrients den
              JOIN app.nutrients n ON n.id = den.nutrient_id AND n.key = 'energy'
              WHERE den.entry_id = ${entryId}`)
          )[0]!.amount
        )
      const servingEnergy = async (id: number) =>
        Number(
          (
            await rows(sql`
              SELECT fn.amount::float AS amount FROM app.food_servings fs
              JOIN app.food_nutrients fn ON fn.food_serving_id = fs.id
              JOIN app.nutrients n ON n.id = fn.nutrient_id AND n.key = 'energy'
              WHERE fs.food_id = ${id}`)
          )[0]!.amount
        )

      await tx.execute(sql`
        UPDATE app.food_nutrients fn SET amount = 999
        FROM app.food_servings fs, app.nutrients n
        WHERE fs.id = fn.food_serving_id AND fs.food_id IN (${idList([foodId, catalogue.id])})
          AND n.id = fn.nutrient_id AND n.key = 'energy'`)
      await tx.execute(sql`
        UPDATE app.diary_entry_nutrients den SET amount = 999
        FROM app.nutrients n
        WHERE n.id = den.nutrient_id AND n.key = 'energy'
          AND den.entry_id IN (${idList([oldEntry.id, foodEntry.id, recipeEntry.id])})`)
      await tx.execute(sql`
        UPDATE app.diary_entries
        SET ingredient_snapshot = jsonb_set(ingredient_snapshot, '{0,nutrients,energy}', '999')
          || '[{"name": "Bare item", "quantity": 1}]'::jsonb
        WHERE id = ${recipeEntry.id}`)
      await tx.execute(sql`UPDATE app.diary_entries SET updated_at = '2000-01-01' WHERE id IN (${idList(ids)})`)
      expect(await servingEnergy(foodId)).toBe(999)
      expect(await servingEnergy(catalogue.id)).toBe(999)

      for (let run = 0; run < 2; run++) {
        for (const stmt of statements) await tx.execute(sql.raw(stmt))
      }

      expect(await servingEnergy(foodId)).toBe(165)
      expect(await servingEnergy(catalogue.id)).toBe(29)
      expect(await energyOf(foodEntry.id)).toBe(165)
      expect(await energyOf(oldEntry.id)).toBe(999)
      expect(await energyOf(quickEntry.id)).toBe(300)

      const stored = await rows(sql`
        SELECT n.key, den.amount::float AS amount, e.ingredient_snapshot AS snap
        FROM app.diary_entries e
        JOIN app.diary_entry_nutrients den ON den.entry_id = e.id
        JOIN app.nutrients n ON n.id = den.nutrient_id
        WHERE e.id = ${recipeEntry.id}`)
      const by = Object.fromEntries(stored.map((r) => [r.key as string, Number(r.amount)]))
      const expected = 4 * (by.protein ?? 0) + 4 * (by.carbohydrate ?? 0) + 9 * (by.fat ?? 0)
      expect(expected).toBeGreaterThan(0)
      expect(by.energy).toBeCloseTo(expected, 6)
      const snapshot = stored[0]!.snap as SnapshotItem[]
      expect(snapshot).toHaveLength(3)
      expect(snapshot[2]).toEqual({ name: 'Bare item', quantity: 1 })
      const sum = snapshot.slice(0, 2).reduce((acc, i) => acc + Number(i.nutrients!.energy), 0)
      expect(sum).toBeCloseTo(expected, 6)

      const stamps = await rows(
        sql`SELECT id, updated_at > '2001-01-01' AS bumped FROM app.diary_entries WHERE id IN (${idList(ids)})`
      )
      const bumped = new Map(stamps.map((r) => [r.id as number, r.bumped as boolean]))
      expect(bumped.get(foodEntry.id)).toBe(true)
      expect(bumped.get(recipeEntry.id)).toBe(true)
      expect(bumped.get(quickEntry.id)).toBe(false)
      expect(bumped.get(oldEntry.id)).toBe(false)
      throw ROLLBACK
    })
  ).catch((err: unknown) => {
    if (err !== ROLLBACK) throw err
    return 'rolled back'
  })
  expect(outcome).toBe('rolled back')
})
