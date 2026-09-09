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
CREATE INDEX "search_outbox_pending" ON "app"."search_outbox" USING btree ("id") WHERE processed_at is null;