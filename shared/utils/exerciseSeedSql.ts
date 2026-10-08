import {
  barWeightFor,
  categoryKeyFor,
  CATEGORY_SEEDS,
  difficultyFor,
  EQUIPMENT_KEYS,
  loadStyleFor,
  MUSCLE_BODY_MAP,
  MUSCLE_CATEGORY,
  trackingTypeFor
} from './exerciseSeedMap'
import type { SeedEntry } from './exerciseSeedMap'

function lit(value: string | null): string {
  if (value === null) return 'null'
  return `'${value.replaceAll('\'', '\'\'')}'`
}

// SQL null, not the JSON value null that `'null'::jsonb` would store.
function jsonbOrNull(value: string[] | null): string {
  return value === null ? 'null' : `${lit(JSON.stringify(value))}::jsonb`
}

function titleCase(key: string): string {
  return key.replace(/(^|[\s-])([a-z])/g, (_match, sep: string, ch: string) => sep + ch.toUpperCase())
}

function categoriesSql(): string {
  const rows = CATEGORY_SEEDS
    .map((c) => `  (null, ${lit(c.key)}, ${lit(c.name)}, ${lit(c.color)}, ${c.sortOrder})`)
    .join(',\n')
  const set = 'name = excluded.name, color = excluded.color, sort_order = excluded.sort_order, updated_at = now()'
  return `insert into app.exercise_categories (user_id, key, name, color, sort_order) values\n${rows}\n`
    + `on conflict (key) where user_id is null do update set ${set};`
}

function musclesSql(): string {
  const rows = Object.keys(MUSCLE_CATEGORY)
    .map((key) => {
      const bodyMap = MUSCLE_BODY_MAP[key] ?? []
      return `  (${lit(key)}, ${lit(titleCase(key))}, ${lit(MUSCLE_CATEGORY[key] ?? null)}, `
        + `${lit(JSON.stringify(bodyMap))}::jsonb)`
    })
    .join(',\n')
  const set = 'name = excluded.name, category_key = excluded.category_key, '
    + 'body_map_groups = excluded.body_map_groups, updated_at = now()'
  return `insert into app.muscles (key, name, category_key, body_map_groups) values\n${rows}\n`
    + `on conflict (key) do update set ${set};`
}

function equipmentSql(): string {
  const rows = EQUIPMENT_KEYS.map((key) => `  (${lit(key)}, ${lit(titleCase(key))})`).join(',\n')
  return `insert into app.equipment (key, name) values\n${rows}\n`
    + 'on conflict (key) do update set name = excluded.name, updated_at = now();'
}

function exerciseSql(entry: SeedEntry): string {
  const categoryKey = categoryKeyFor(entry)
  const trackingType = trackingTypeFor(entry)
  const loadStyle = loadStyleFor(entry)
  const barWeight = barWeightFor(entry)
  const difficulty = difficultyFor(entry)
  const columns = 'name, category_id, tracking_type, load_style, bar_weight, difficulty, instructions, '
    + 'images, external_id'
  const values = `${lit(entry.name)}, c.id, ${lit(trackingType)}, ${lit(loadStyle)}, `
    + `${barWeight === null ? 'null' : barWeight}, ${lit(difficulty)}, `
    + `${jsonbOrNull(entry.instructions)}, ${jsonbOrNull(entry.images ?? [])}, ${lit(entry.id)}`
  return `insert into app.exercises (${columns})
select ${values}
from app.exercise_categories c where c.key = ${lit(categoryKey)} and c.user_id is null
on conflict (external_id) where created_by_user_id is null do update set
  name = excluded.name,
  category_id = excluded.category_id,
  tracking_type = excluded.tracking_type,
  load_style = excluded.load_style,
  bar_weight = excluded.bar_weight,
  difficulty = excluded.difficulty,
  instructions = excluded.instructions,
  images = excluded.images,
  updated_at = now();`
}

// Links are replaced, not merged: `on conflict do nothing` alone keeps a muscle or equipment dropped upstream.
function clearLinksSql(table: 'exercise_muscles' | 'exercise_equipment', entries: SeedEntry[]): string {
  if (entries.length === 0) return ''
  return `delete from app.${table} l
using app.exercises e
where l.exercise_id = e.id and e.created_by_user_id is null
  and e.external_id in (${entries.map((entry) => lit(entry.id)).join(', ')});`
}

function muscleLinksSql(entries: SeedEntry[]): string {
  const rows: string[] = []
  for (const entry of entries) {
    for (const muscle of entry.primaryMuscles) rows.push(`  (${lit(entry.id)}, ${lit(muscle)}, true)`)
    for (const muscle of entry.secondaryMuscles) rows.push(`  (${lit(entry.id)}, ${lit(muscle)}, false)`)
  }
  if (rows.length === 0) return ''
  return `insert into app.exercise_muscles (exercise_id, muscle_id, is_primary)
select e.id, m.id, v.is_primary
from (values
${rows.join(',\n')}
) as v(external_id, muscle_key, is_primary)
join app.exercises e on e.external_id = v.external_id and e.created_by_user_id is null
join app.muscles m on m.key = v.muscle_key
on conflict do nothing;`
}

function equipmentLinksSql(entries: SeedEntry[]): string {
  const rows = entries
    .filter((entry) => entry.equipment !== null)
    .map((entry) => `  (${lit(entry.id)}, ${lit(entry.equipment)})`)
  if (rows.length === 0) return ''
  return `insert into app.exercise_equipment (exercise_id, equipment_id)
select e.id, q.id
from (values
${rows.join(',\n')}
) as v(external_id, equipment_key)
join app.exercises e on e.external_id = v.external_id and e.created_by_user_id is null
join app.equipment q on q.key = v.equipment_key
on conflict do nothing;`
}

export function buildSeedSql(entries: SeedEntry[]): string {
  const statements = [
    categoriesSql(),
    musclesSql(),
    equipmentSql(),
    ...entries.map(exerciseSql),
    clearLinksSql('exercise_muscles', entries),
    muscleLinksSql(entries),
    clearLinksSql('exercise_equipment', entries),
    equipmentLinksSql(entries)
  ].filter((statement) => statement.length > 0)
  return statements.join('\n--> statement-breakpoint\n')
}
