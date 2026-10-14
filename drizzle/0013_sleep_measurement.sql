INSERT INTO "app"."measurement_types" ("user_id", "key", "name", "unit", "precision", "direction") VALUES
  (NULL, 'sleep', 'Sleep', 'h', 1, 'higher')
ON CONFLICT ("key") WHERE user_id IS NULL DO UPDATE SET
  "name" = excluded."name",
  "unit" = excluded."unit",
  "precision" = excluded."precision",
  "direction" = excluded."direction";
