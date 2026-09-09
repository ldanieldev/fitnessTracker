-- Kept in step with NUTRIENT_SEED in server/db/seed/nutrition.ts; test/unit/nutritionSeed.test.ts asserts they match.
INSERT INTO "app"."nutrients" ("key", "name", "unit", "is_macro", "default_direction", "sort_order") VALUES
  ('energy', 'Calories', 'kcal', true, 'max', 0),
  ('protein', 'Protein', 'g', true, 'min', 1),
  ('carbohydrate', 'Carbs', 'g', true, 'max', 2),
  ('fat', 'Fat', 'g', true, 'max', 3),
  ('fiber', 'Fiber', 'g', false, 'min', 4),
  ('sugar', 'Sugar', 'g', false, 'max', 5),
  ('saturatedFat', 'Saturated Fat', 'g', false, 'max', 6),
  ('cholesterol', 'Cholesterol', 'mg', false, 'max', 7),
  ('sodium', 'Sodium', 'mg', false, 'max', 8),
  ('potassium', 'Potassium', 'mg', false, 'min', 9)
ON CONFLICT ("key") DO UPDATE SET
  "name" = excluded."name",
  "unit" = excluded."unit",
  "is_macro" = excluded."is_macro",
  "default_direction" = excluded."default_direction",
  "sort_order" = excluded."sort_order";
