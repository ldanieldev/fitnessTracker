-- Custom SQL migration file, put your code below! --
UPDATE "app"."diary_entries" e SET description = f.name FROM "app"."foods" f WHERE e.food_id = f.id AND e.import_key IS NOT NULL AND e.description IS NULL;
