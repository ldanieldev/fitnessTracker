WITH ids AS (
  SELECT (SELECT id FROM app.nutrients WHERE key = 'energy') AS energy,
         (SELECT id FROM app.nutrients WHERE key = 'protein') AS protein,
         (SELECT id FROM app.nutrients WHERE key = 'carbohydrate') AS carb,
         (SELECT id FROM app.nutrients WHERE key = 'fat') AS fat
), calc AS (
  SELECT fs.id AS serving_id,
         4 * coalesce(max(fn.amount) FILTER (WHERE fn.nutrient_id = ids.protein), 0)
       + 4 * coalesce(max(fn.amount) FILTER (WHERE fn.nutrient_id = ids.carb), 0)
       + 9 * coalesce(max(fn.amount) FILTER (WHERE fn.nutrient_id = ids.fat), 0) AS energy
  FROM app.food_servings fs CROSS JOIN ids
  LEFT JOIN app.food_nutrients fn ON fn.food_serving_id = fs.id
  WHERE fs.has_own_nutrition
  GROUP BY fs.id
)
INSERT INTO app.food_nutrients (food_serving_id, nutrient_id, amount)
SELECT calc.serving_id, ids.energy, calc.energy FROM calc CROSS JOIN ids
ON CONFLICT (food_serving_id, nutrient_id) DO UPDATE SET amount = excluded.amount;
--> statement-breakpoint
WITH ids AS (
  SELECT (SELECT id FROM app.nutrients WHERE key = 'energy') AS energy,
         (SELECT id FROM app.nutrients WHERE key = 'protein') AS protein,
         (SELECT id FROM app.nutrients WHERE key = 'carbohydrate') AS carb,
         (SELECT id FROM app.nutrients WHERE key = 'fat') AS fat
), calc AS (
  SELECT e.id AS entry_id,
         4 * coalesce(max(den.amount) FILTER (WHERE den.nutrient_id = ids.protein), 0)
       + 4 * coalesce(max(den.amount) FILTER (WHERE den.nutrient_id = ids.carb), 0)
       + 9 * coalesce(max(den.amount) FILTER (WHERE den.nutrient_id = ids.fat), 0) AS energy
  FROM app.diary_entries e
  JOIN app.diary_days d ON d.id = e.day_id
  CROSS JOIN ids
  LEFT JOIN app.diary_entry_nutrients den ON den.entry_id = e.id
  WHERE d.date >= '2026-10-24' AND e.entry_type IN ('food', 'recipe')
  GROUP BY e.id
)
INSERT INTO app.diary_entry_nutrients (entry_id, nutrient_id, amount)
SELECT calc.entry_id, ids.energy, calc.energy FROM calc CROSS JOIN ids
ON CONFLICT (entry_id, nutrient_id) DO UPDATE SET amount = excluded.amount;
--> statement-breakpoint
UPDATE app.diary_entries e SET ingredient_snapshot = (
  SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(item -> 'nutrients') = 'object' THEN jsonb_set(item, '{nutrients,energy}', to_jsonb(
        4 * coalesce((item -> 'nutrients' ->> 'protein')::numeric, 0)
      + 4 * coalesce((item -> 'nutrients' ->> 'carbohydrate')::numeric, 0)
      + 9 * coalesce((item -> 'nutrients' ->> 'fat')::numeric, 0)))
    ELSE item END ORDER BY ord)
  FROM jsonb_array_elements(e.ingredient_snapshot) WITH ORDINALITY AS t(item, ord))
FROM app.diary_days d
WHERE d.id = e.day_id AND d.date >= '2026-10-24' AND e.entry_type = 'recipe'
  AND jsonb_typeof(e.ingredient_snapshot) = 'array' AND jsonb_array_length(e.ingredient_snapshot) > 0;
--> statement-breakpoint
-- Bumping updated_at invalidates the dashboard's stamped nutrition cache.
UPDATE app.diary_entries e SET updated_at = now()
FROM app.diary_days d
WHERE d.id = e.day_id AND d.date >= '2026-10-24' AND e.entry_type IN ('food', 'recipe');
