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
ALTER TABLE "app"."user_tracked_nutrients" ADD CONSTRAINT "user_tracked_nutrients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_tracked_nutrients" ADD CONSTRAINT "user_tracked_nutrients_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "app"."nutrients"("id") ON DELETE no action ON UPDATE no action;