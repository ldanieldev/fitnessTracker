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
	CONSTRAINT "serving_quantity_positive" CHECK (quantity > 0)
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
CREATE UNIQUE INDEX "food_one_weight_serving" ON "app"."food_servings" USING btree ("food_id") WHERE kind = 'weight' and deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "food_source_key_unique" ON "app"."food_sources" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "food_catalog_barcode_unique" ON "app"."foods" USING btree ("barcode") WHERE created_by_user_id is null and deleted_at is null;