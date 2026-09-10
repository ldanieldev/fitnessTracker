import { createHash } from 'node:crypto'
import type { ImportWarning, MacroSet, MassUnit } from '~~/shared/types/nutrition'
import { normalizeUnitLabel, toGrams } from '~~/shared/utils/nutritionUnits'
import type { ParsedDay, ParsedRow } from './parse'

export interface PlannedServing {
  kind: 'weight' | 'named'
  label: string
  quantity: number
  basisGrams: number | null
  perUnit: MacroSet
}

export interface PlannedFood {
  key: string
  name: string
  servings: PlannedServing[]
}

export interface PlannedEntry {
  date: string
  container: string
  ordinal: number
  importKey: string
  kind: 'food' | 'quick_add'
  foodKey: string | null
  servingLabel: string | null
  quantity: number
  unitLabel: string
  gramsResolved: number | null
  nutrients: MacroSet
  description: string | null
}

export interface ImportPlan {
  foods: PlannedFood[]
  entries: PlannedEntry[]
  warnings: ImportWarning[]
  containers: string[]
}

const MACRO_KEYS: (keyof MacroSet)[] = ['kcal', 'protein', 'carbs', 'fat']

type ResolvedUnit = { kind: 'food', servingLabel: string | null } | { kind: 'quick_add' }

interface DatedRow {
  row: ParsedRow
  date: string
}

interface FoodGroup {
  name: string
  key: string
  rowsByUnit: Map<string, DatedRow[]>
  resolvedUnits: Map<string, ResolvedUnit>
}

export function foodKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function importKey(userId: number, row: ParsedRow, date: string): string {
  return createHash('sha256').update(`mymacros|${userId}|${date}|${row.container}|${row.ordinal}|${row.raw}`).digest('hex')
}

function perUnitOfRow(row: ParsedRow): MacroSet {
  return { kcal: row.kcal / row.quantity, protein: row.protein / row.quantity, carbs: row.carbs / row.quantity, fat: row.fat / row.quantity }
}

function perGramOf(row: ParsedRow, grams: number): MacroSet {
  return { kcal: row.kcal / grams, protein: row.protein / grams, carbs: row.carbs / grams, fat: row.fat / grams }
}

// A mass alias other than g/oz (e.g. lb) always folds into the gram weight basis — unlike oz it has no fluid ambiguity.
function weightAliasUnit(unit: string): MassUnit | null {
  try {
    const normalized = normalizeUnitLabel(unit)
    return normalized.kind === 'weight' ? normalized.unit : null
  } catch {
    return null
  }
}

function scale(macro: MacroSet, factor: number): MacroSet {
  return { kcal: macro.kcal * factor, protein: macro.protein * factor, carbs: macro.carbs * factor, fat: macro.fat * factor }
}

function isConsistent(perUnitSet: MacroSet[]): boolean {
  return MACRO_KEYS.every((key) => {
    const values = perUnitSet.map((m) => m[key])
    const max = Math.max(...values)
    const min = Math.min(...values)
    return max - min <= Math.max(0.01 * max, 0.02)
  })
}

function largestQuantity(rows: ParsedRow[]): ParsedRow {
  return rows.reduce((a, b) => (b.quantity > a.quantity ? b : a))
}

function commonBasisGrams(rows: ParsedRow[]): number | null {
  const first = rows[0]!.basisGrams
  return first !== null && rows.every((r) => r.basisGrams === first) ? first : null
}

export function planImport(days: ParsedDay[], userId: number): ImportPlan {
  const flat: DatedRow[] = []
  const containers: string[] = []
  for (const day of days) {
    for (const row of day.rows) {
      flat.push({ row, date: day.date })
      if (!containers.includes(row.container)) containers.push(row.container)
    }
  }

  const foodGroups = new Map<string, FoodGroup>()
  for (const item of flat) {
    const key = foodKey(item.row.name)
    let group = foodGroups.get(key)
    if (!group) {
      group = { name: item.row.name, key, rowsByUnit: new Map(), resolvedUnits: new Map() }
      foodGroups.set(key, group)
    }
    const unitRows = group.rowsByUnit.get(item.row.unit) ?? []
    unitRows.push(item)
    group.rowsByUnit.set(item.row.unit, unitRows)
  }

  const foods: PlannedFood[] = []
  const warnings: ImportWarning[] = []

  for (const group of foodGroups.values()) {
    const servings: PlannedServing[] = []

    const consistency = new Map<string, boolean>()
    const chosenPerUnit = new Map<string, MacroSet>()
    for (const [unit, items] of group.rowsByUnit) {
      const rows = items.map((i) => i.row)
      const consistent = isConsistent(rows.map(perUnitOfRow))
      consistency.set(unit, consistent)
      if (consistent) chosenPerUnit.set(unit, perUnitOfRow(largestQuantity(rows)))
    }

    const gItems = group.rowsByUnit.get('g')
    const ozItems = group.rowsByUnit.get('oz')
    const extraWeightUnits = [...group.rowsByUnit.keys()].filter((unit) => unit !== 'g' && unit !== 'oz' && weightAliasUnit(unit) !== null)

    let ozMode: 'mass' | 'fluid' | null = null
    if (ozItems && consistency.get('oz')) {
      if (gItems && consistency.get('g')) {
        const gramPerUnit = chosenPerUnit.get('g')!
        const combined = [gramPerUnit, ...ozItems.map((i) => perGramOf(i.row, toGrams(i.row.quantity, 'oz')))]
        ozMode = isConsistent(combined) ? 'mass' : 'fluid'
      } else {
        ozMode = 'fluid'
      }
    }

    // g and any other mass alias (lb, ...) share one weight basis, consistency-checked together.
    const weightRows: Array<{ perGram: MacroSet, grams: number }> = []
    if (gItems) for (const item of gItems) weightRows.push({ perGram: perUnitOfRow(item.row), grams: item.row.quantity })
    for (const unit of extraWeightUnits) {
      const massUnit = weightAliasUnit(unit)!
      for (const item of group.rowsByUnit.get(unit)!) {
        const grams = toGrams(item.row.quantity, massUnit)
        weightRows.push({ perGram: perGramOf(item.row, grams), grams })
      }
    }
    if (weightRows.length > 0) {
      const weightBasisConsistent = isConsistent(weightRows.map((r) => r.perGram))
      if (weightBasisConsistent) {
        const weightBasisPerGram = weightRows.reduce((a, b) => (b.grams > a.grams ? b : a)).perGram
        if (gItems) group.resolvedUnits.set('g', { kind: 'food', servingLabel: null })
        for (const unit of extraWeightUnits) group.resolvedUnits.set(unit, { kind: 'food', servingLabel: null })
        servings.push({ kind: 'weight', label: 'g', quantity: 100, basisGrams: 100, perUnit: scale(weightBasisPerGram, 100) })
      } else {
        if (gItems) {
          group.resolvedUnits.set('g', { kind: 'quick_add' })
          warnings.push({ date: gItems[0]!.date, code: 'inconsistent_group', message: `${group.name} (g) has inconsistent per-unit nutrition` })
        }
        for (const unit of extraWeightUnits) {
          group.resolvedUnits.set(unit, { kind: 'quick_add' })
          warnings.push({ date: group.rowsByUnit.get(unit)![0]!.date, code: 'inconsistent_group', message: `${group.name} (${unit}) has inconsistent per-unit nutrition` })
        }
      }
    }

    for (const [unit, items] of group.rowsByUnit) {
      if (unit === 'g' || extraWeightUnits.includes(unit)) continue

      if (unit.trim() === '') {
        group.resolvedUnits.set(unit, { kind: 'quick_add' })
        warnings.push({ date: items[0]!.date, code: 'unsupported_unit', message: `${group.name}: unit "" is not supported` })
        continue
      }

      const consistent = consistency.get(unit)!
      if (!consistent) {
        group.resolvedUnits.set(unit, { kind: 'quick_add' })
        warnings.push({ date: items[0]!.date, code: 'inconsistent_group', message: `${group.name} (${unit}) has inconsistent per-unit nutrition` })
        continue
      }

      if (unit === 'oz') {
        if (ozMode === 'mass') {
          group.resolvedUnits.set(unit, { kind: 'food', servingLabel: null })
        } else {
          group.resolvedUnits.set(unit, { kind: 'food', servingLabel: 'fl oz' })
          servings.push({ kind: 'named', label: 'fl oz', quantity: 1, basisGrams: null, perUnit: chosenPerUnit.get('oz')! })
          const message = gItems
            ? `${group.name} ounces do not match its gram servings; treating as fluid ounces`
            : `${group.name}: ounces imported as fluid ounces (no gram rows to compare against)`
          warnings.push({ date: items[0]!.date, code: 'oz_as_fluid', message })
        }
        continue
      }

      group.resolvedUnits.set(unit, { kind: 'food', servingLabel: unit })
      servings.push({
        kind: 'named',
        label: unit,
        quantity: 1,
        basisGrams: commonBasisGrams(items.map((i) => i.row)),
        perUnit: chosenPerUnit.get(unit)!
      })
    }

    if (servings.length > 0) foods.push({ key: group.key, name: group.name, servings })
  }

  const entries: PlannedEntry[] = flat.map(({ row, date }) => {
    const group = foodGroups.get(foodKey(row.name))!
    const resolved = group.resolvedUnits.get(row.unit)!
    const kind = resolved.kind
    const servingLabel = kind === 'food' ? resolved.servingLabel : null
    const massAlias = weightAliasUnit(row.unit)
    const isMassWeight = row.unit !== 'g' && kind === 'food' && servingLabel === null && massAlias !== null
    const unitLabel = row.unit === 'oz' && kind === 'food' && servingLabel === 'fl oz' ? 'fl oz' : row.unit

    let gramsResolved: number | null = null
    if (row.unit === 'g') gramsResolved = row.quantity
    else if (isMassWeight) gramsResolved = toGrams(row.quantity, massAlias!)
    else if (row.basisGrams !== null) gramsResolved = row.basisGrams * row.quantity

    return {
      date,
      container: row.container,
      ordinal: row.ordinal,
      importKey: importKey(userId, row, date),
      kind,
      foodKey: kind === 'food' ? group.key : null,
      servingLabel,
      quantity: row.quantity,
      unitLabel,
      gramsResolved,
      nutrients: { kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat },
      description: row.name
    }
  })

  for (const day of days) {
    const sum = day.rows.reduce(
      (acc, row) => ({ kcal: acc.kcal + row.kcal, protein: acc.protein + row.protein, carbs: acc.carbs + row.carbs, fat: acc.fat + row.fat }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    )
    const dKcal = Math.abs(sum.kcal - day.dailyTotals.kcal)
    const dProtein = Math.abs(sum.protein - day.dailyTotals.protein)
    const dCarbs = Math.abs(sum.carbs - day.dailyTotals.carbs)
    const dFat = Math.abs(sum.fat - day.dailyTotals.fat)
    if (dKcal > 0.5 || dProtein > 0.1 || dCarbs > 0.1 || dFat > 0.1) {
      warnings.push({
        date: day.date,
        code: 'checksum',
        message: `Daily totals mismatch for ${day.date}: kcal Δ${dKcal.toFixed(2)}, protein Δ${dProtein.toFixed(2)}, carbs Δ${dCarbs.toFixed(2)}, fat Δ${dFat.toFixed(2)}`
      })
    }
  }

  return { foods, entries, warnings, containers }
}
