INSERT INTO app.food_sources (key, name, license_notice, attribution_required, persistable)
VALUES ('mymacros','My Macros+ import',NULL,false,true)
ON CONFLICT (key) DO UPDATE SET name = excluded.name, license_notice = excluded.license_notice, attribution_required = excluded.attribution_required, persistable = excluded.persistable;
