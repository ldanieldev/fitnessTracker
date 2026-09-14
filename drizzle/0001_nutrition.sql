CREATE TABLE "app"."nutrients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."nutrients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"key" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"unit" varchar NOT NULL,
	"is_macro" boolean DEFAULT false NOT NULL,
	"default_direction" varchar DEFAULT 'target' NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "nutrient_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "app"."user_tracked_nutrients" (
	"user_id" integer NOT NULL,
	"nutrient_id" integer NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "user_tracked_nutrients_user_id_nutrient_id_pk" PRIMARY KEY("user_id","nutrient_id")
);
--> statement-breakpoint
CREATE TABLE "app"."food_favorites" (
	"user_id" integer NOT NULL,
	"food_id" integer NOT NULL,
	CONSTRAINT "food_favorites_user_id_food_id_pk" PRIMARY KEY("user_id","food_id")
);
--> statement-breakpoint
CREATE TABLE "app"."food_nutrients" (
	"food_serving_id" integer NOT NULL,
	"nutrient_id" integer NOT NULL,
	"amount" numeric NOT NULL,
	CONSTRAINT "food_nutrients_food_serving_id_nutrient_id_pk" PRIMARY KEY("food_serving_id","nutrient_id")
);
--> statement-breakpoint
CREATE TABLE "app"."food_servings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."food_servings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"food_id" integer NOT NULL,
	"kind" varchar NOT NULL,
	"label" varchar(64) NOT NULL,
	"quantity" numeric DEFAULT '1' NOT NULL,
	"basis_grams" numeric DEFAULT null,
	"has_own_nutrition" boolean NOT NULL,
	"origin" varchar NOT NULL,
	"user_modified" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp DEFAULT null,
	CONSTRAINT "serving_has_basis" CHECK (has_own_nutrition or basis_grams is not null),
	CONSTRAINT "weight_serving_owns_nutrition" CHECK (kind <> 'weight' or (basis_grams is not null and has_own_nutrition)),
	CONSTRAINT "serving_quantity_positive" CHECK (quantity > 0),
	CONSTRAINT "serving_basis_grams_positive" CHECK (basis_grams is null or basis_grams > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."food_sources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."food_sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"key" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"license_notice" text DEFAULT null,
	"attribution_required" boolean DEFAULT false NOT NULL,
	"persistable" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."food_usage_stats" (
	"user_id" integer NOT NULL,
	"food_id" integer NOT NULL,
	"log_count" integer DEFAULT 0 NOT NULL,
	"last_logged_at" timestamp NOT NULL,
	CONSTRAINT "food_usage_stats_user_id_food_id_pk" PRIMARY KEY("user_id","food_id")
);
--> statement-breakpoint
CREATE TABLE "app"."foods" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."foods_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"name" varchar(255) NOT NULL,
	"brand" varchar(255) DEFAULT null,
	"created_by_user_id" integer DEFAULT null,
	"source_id" integer DEFAULT null,
	"external_id" varchar(255) DEFAULT null,
	"barcode" varchar(64) DEFAULT null,
	"forked_from_food_id" integer DEFAULT null,
	"is_verified" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "app"."goal_profile_targets" (
	"profile_id" integer NOT NULL,
	"nutrient_id" integer NOT NULL,
	"amount" numeric NOT NULL,
	"direction" varchar NOT NULL,
	"ratio_percent" numeric DEFAULT null,
	CONSTRAINT "goal_profile_targets_profile_id_nutrient_id_pk" PRIMARY KEY("profile_id","nutrient_id")
);
--> statement-breakpoint
CREATE TABLE "app"."goal_profiles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."goal_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"input_mode" varchar NOT NULL,
	"calories" numeric DEFAULT null,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "app"."search_outbox" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."search_outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"entity" varchar(32) NOT NULL,
	"entity_id" integer NOT NULL,
	"op" varchar NOT NULL,
	"processed_at" timestamp DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "app"."recipe_ingredients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."recipe_ingredients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"recipe_id" integer NOT NULL,
	"food_id" integer NOT NULL,
	"food_serving_id" integer NOT NULL,
	"quantity" numeric NOT NULL,
	"unit_label" varchar(64) NOT NULL,
	"grams_resolved" numeric DEFAULT null,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."recipes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."recipes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"servings" numeric NOT NULL,
	"serving_name" varchar(64) NOT NULL,
	"finished_weight_g" numeric DEFAULT null,
	"notes" text DEFAULT null,
	"deleted_at" timestamp DEFAULT null,
	CONSTRAINT "recipe_servings_positive" CHECK (servings > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."saved_meal_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."saved_meal_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"saved_meal_id" integer NOT NULL,
	"food_id" integer NOT NULL,
	"food_serving_id" integer NOT NULL,
	"quantity" numeric NOT NULL,
	"unit_label" varchar(64) NOT NULL,
	"grams_resolved" numeric DEFAULT null,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."saved_meals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."saved_meals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"deleted_at" timestamp DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "app"."diary_day_targets" (
	"day_id" integer NOT NULL,
	"nutrient_id" integer NOT NULL,
	"amount" numeric NOT NULL,
	"direction" varchar NOT NULL,
	CONSTRAINT "diary_day_targets_day_id_nutrient_id_pk" PRIMARY KEY("day_id","nutrient_id")
);
--> statement-breakpoint
CREATE TABLE "app"."diary_days" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."diary_days_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"notes" text DEFAULT null,
	"goal_profile_id" integer DEFAULT null,
	CONSTRAINT "diary_day_user_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "app"."diary_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."diary_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"day_id" integer NOT NULL,
	"container_id" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"entry_type" varchar NOT NULL,
	"food_id" integer DEFAULT null,
	"food_serving_id" integer DEFAULT null,
	"recipe_id" integer DEFAULT null,
	"quantity" numeric NOT NULL,
	"unit_label" varchar(64) NOT NULL,
	"grams_resolved" numeric DEFAULT null,
	"description" varchar(255) DEFAULT null,
	"brand_snapshot" varchar(255) DEFAULT null,
	"ingredient_snapshot" jsonb DEFAULT null,
	"notes" text DEFAULT null,
	"import_key" varchar(64) DEFAULT null,
	CONSTRAINT "entry_quantity_positive" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."diary_entry_nutrients" (
	"entry_id" integer NOT NULL,
	"nutrient_id" integer NOT NULL,
	"amount" numeric NOT NULL,
	CONSTRAINT "diary_entry_nutrients_entry_id_nutrient_id_pk" PRIMARY KEY("entry_id","nutrient_id")
);
--> statement-breakpoint
CREATE TABLE "app"."meal_containers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."meal_containers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"sort_order" integer NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "meal_container_user_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "app"."import_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."import_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"source" varchar NOT NULL,
	"status" varchar DEFAULT 'queued' NOT NULL,
	"file_count" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb DEFAULT null,
	"error" text DEFAULT null
);
--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "week_start" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."user_tracked_nutrients" ADD CONSTRAINT "user_tracked_nutrients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_tracked_nutrients" ADD CONSTRAINT "user_tracked_nutrients_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "app"."nutrients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."food_favorites" ADD CONSTRAINT "food_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."food_favorites" ADD CONSTRAINT "food_favorites_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "app"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."food_nutrients" ADD CONSTRAINT "food_nutrients_food_serving_id_food_servings_id_fk" FOREIGN KEY ("food_serving_id") REFERENCES "app"."food_servings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."food_nutrients" ADD CONSTRAINT "food_nutrients_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "app"."nutrients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."food_servings" ADD CONSTRAINT "food_servings_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "app"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."food_usage_stats" ADD CONSTRAINT "food_usage_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."food_usage_stats" ADD CONSTRAINT "food_usage_stats_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "app"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."foods" ADD CONSTRAINT "foods_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."foods" ADD CONSTRAINT "foods_source_id_food_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "app"."food_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."foods" ADD CONSTRAINT "foods_forked_from_food_id_foods_id_fk" FOREIGN KEY ("forked_from_food_id") REFERENCES "app"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."goal_profile_targets" ADD CONSTRAINT "goal_profile_targets_profile_id_goal_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "app"."goal_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."goal_profile_targets" ADD CONSTRAINT "goal_profile_targets_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "app"."nutrients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."goal_profiles" ADD CONSTRAINT "goal_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "app"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "app"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_serving_id_food_servings_id_fk" FOREIGN KEY ("food_serving_id") REFERENCES "app"."food_servings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."saved_meal_items" ADD CONSTRAINT "saved_meal_items_saved_meal_id_saved_meals_id_fk" FOREIGN KEY ("saved_meal_id") REFERENCES "app"."saved_meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."saved_meal_items" ADD CONSTRAINT "saved_meal_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "app"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."saved_meal_items" ADD CONSTRAINT "saved_meal_items_food_serving_id_food_servings_id_fk" FOREIGN KEY ("food_serving_id") REFERENCES "app"."food_servings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."saved_meals" ADD CONSTRAINT "saved_meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_day_targets" ADD CONSTRAINT "diary_day_targets_day_id_diary_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "app"."diary_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_day_targets" ADD CONSTRAINT "diary_day_targets_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "app"."nutrients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_days" ADD CONSTRAINT "diary_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_days" ADD CONSTRAINT "diary_days_goal_profile_id_goal_profiles_id_fk" FOREIGN KEY ("goal_profile_id") REFERENCES "app"."goal_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_entries" ADD CONSTRAINT "diary_entries_day_id_diary_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "app"."diary_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_entries" ADD CONSTRAINT "diary_entries_container_id_meal_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "app"."meal_containers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_entries" ADD CONSTRAINT "diary_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "app"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_entries" ADD CONSTRAINT "diary_entries_food_serving_id_food_servings_id_fk" FOREIGN KEY ("food_serving_id") REFERENCES "app"."food_servings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_entries" ADD CONSTRAINT "diary_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "app"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_entry_nutrients" ADD CONSTRAINT "diary_entry_nutrients_entry_id_diary_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "app"."diary_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."diary_entry_nutrients" ADD CONSTRAINT "diary_entry_nutrients_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "app"."nutrients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."meal_containers" ADD CONSTRAINT "meal_containers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_one_weight_serving" ON "app"."food_servings" USING btree ("food_id") WHERE kind = 'weight' and deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "food_source_key_unique" ON "app"."food_sources" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "food_catalog_barcode_unique" ON "app"."foods" USING btree ("barcode") WHERE created_by_user_id is null and deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "food_catalog_external_unique" ON "app"."foods" USING btree ("source_id","external_id") WHERE created_by_user_id is null and deleted_at is null and external_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "food_owned_external_unique" ON "app"."foods" USING btree ("created_by_user_id","source_id","external_id") WHERE created_by_user_id is not null and deleted_at is null and external_id is not null;--> statement-breakpoint
CREATE INDEX "food_owner_live" ON "app"."foods" USING btree ("created_by_user_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_profile_one_default" ON "app"."goal_profiles" USING btree ("user_id") WHERE is_default and deleted_at is null;--> statement-breakpoint
CREATE INDEX "search_outbox_pending" ON "app"."search_outbox" USING btree ("id") WHERE processed_at is null;--> statement-breakpoint
CREATE INDEX "diary_entry_day_container_order" ON "app"."diary_entries" USING btree ("day_id","container_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "diary_entry_import_key_unique" ON "app"."diary_entries" USING btree ("import_key") WHERE import_key is not null;--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_week_start_check" CHECK ("app"."users"."week_start" in (0, 1));
--> statement-breakpoint
-- Kept in step with NUTRIENT_SEED in server/db/seed/nutrition.ts and FOOD_SOURCE seeds; test/unit/nutritionSeed.test.ts and nutritionFoodSourcesSeed.test.ts assert they match.
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
--> statement-breakpoint
INSERT INTO "app"."food_sources" ("key", "name", "license_notice", "attribution_required", "persistable") VALUES
  ('off','Open Food Facts','ODbL — https://opendatacommons.org/licenses/odbl/',true,true),
  ('usda','USDA FoodData Central','Public domain (CC0)',false,true),
  ('fatsecret','FatSecret','Commercial — fetch-only',true,false),
  ('user','User created',NULL,false,true),
  ('mymacros','My Macros+ import',NULL,false,true)
ON CONFLICT (key) DO UPDATE SET name = excluded.name, license_notice = excluded.license_notice, attribution_required = excluded.attribution_required, persistable = excluded.persistable;
