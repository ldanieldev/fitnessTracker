CREATE TABLE "app"."exercise_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."exercise_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer DEFAULT null,
	"key" varchar(64) DEFAULT null,
	"name" varchar(64) NOT NULL,
	"color" varchar(32) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"deleted_at" timestamp DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "app"."exercise_category_prefs" (
	"user_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(64) DEFAULT null,
	"color" varchar(32) DEFAULT null,
	"sort_order" smallint DEFAULT null,
	"hidden_at" timestamp DEFAULT null,
	CONSTRAINT "exercise_category_prefs_user_id_category_id_pk" PRIMARY KEY("user_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "app"."exercise_prefs" (
	"user_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"category_id" integer DEFAULT null,
	"tracking_type" varchar DEFAULT null,
	"load_style" varchar DEFAULT null,
	"bar_weight" numeric DEFAULT null,
	"weight_increment" numeric DEFAULT null,
	"rest_seconds" integer DEFAULT null,
	"notes" varchar(2000) DEFAULT null,
	"link" varchar(500) DEFAULT null,
	"favorite" boolean DEFAULT false NOT NULL,
	"hidden_at" timestamp DEFAULT null,
	CONSTRAINT "exercise_prefs_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "app"."exercise_variation_groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."exercise_variation_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"name" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."exercise_variation_members" (
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	CONSTRAINT "exercise_variation_members_group_id_exercise_id_pk" PRIMARY KEY("group_id","exercise_id")
);
--> statement-breakpoint
ALTER TABLE "app"."body_parts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."exercise_types" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "app"."body_parts" CASCADE;--> statement-breakpoint
DROP TABLE "app"."exercise_types" CASCADE;--> statement-breakpoint
ALTER TABLE "app"."equipment" DROP CONSTRAINT "equipment_name";--> statement-breakpoint
ALTER TABLE "app"."exercises" DROP CONSTRAINT "exercise_name_user";--> statement-breakpoint
ALTER TABLE "app"."muscles" DROP CONSTRAINT "muscle_name";--> statement-breakpoint
ALTER TABLE "app"."equipment" ALTER COLUMN "name" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "app"."muscles" ALTER COLUMN "name" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "app"."equipment" ADD COLUMN "key" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."exercises" ADD COLUMN "category_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."exercises" ADD COLUMN "tracking_type" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."exercises" ADD COLUMN "load_style" varchar DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."exercises" ADD COLUMN "bar_weight" numeric DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."exercises" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."exercises" ADD COLUMN "external_id" varchar(128) DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."exercises" ADD COLUMN "deleted_at" timestamp DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."muscles" ADD COLUMN "key" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."muscles" ADD COLUMN "category_key" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."muscles" ADD COLUMN "body_map_groups" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."exercise_categories" ADD CONSTRAINT "exercise_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exercise_category_prefs" ADD CONSTRAINT "exercise_category_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exercise_category_prefs" ADD CONSTRAINT "exercise_category_prefs_category_id_exercise_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."exercise_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exercise_prefs" ADD CONSTRAINT "exercise_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exercise_prefs" ADD CONSTRAINT "exercise_prefs_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "app"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exercise_prefs" ADD CONSTRAINT "exercise_prefs_category_id_exercise_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."exercise_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exercise_variation_groups" ADD CONSTRAINT "exercise_variation_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exercise_variation_members" ADD CONSTRAINT "exercise_variation_members_group_id_exercise_variation_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."exercise_variation_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exercise_variation_members" ADD CONSTRAINT "exercise_variation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exercise_variation_members" ADD CONSTRAINT "exercise_variation_members_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "app"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_category_shared_key" ON "app"."exercise_categories" USING btree ("key") WHERE user_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_category_user_name" ON "app"."exercise_categories" USING btree ("user_id",lower(name)) WHERE user_id is not null and deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "variation_group_user_name" ON "app"."exercise_variation_groups" USING btree ("user_id",lower(name));--> statement-breakpoint
CREATE UNIQUE INDEX "variation_member_one_group" ON "app"."exercise_variation_members" USING btree ("user_id","exercise_id");--> statement-breakpoint
ALTER TABLE "app"."exercises" ADD CONSTRAINT "exercises_category_id_exercise_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."exercise_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_key" ON "app"."equipment" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_external_id" ON "app"."exercises" USING btree ("external_id") WHERE created_by_user_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_user_name" ON "app"."exercises" USING btree ("created_by_user_id",lower(name)) WHERE created_by_user_id is not null and deleted_at is null;--> statement-breakpoint
CREATE INDEX "exercise_owner_live" ON "app"."exercises" USING btree ("created_by_user_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "muscle_key" ON "app"."muscles" USING btree ("key");--> statement-breakpoint
ALTER TABLE "app"."exercises" DROP COLUMN "exercise_type_id";--> statement-breakpoint
ALTER TABLE "app"."exercises" DROP COLUMN "image_url";--> statement-breakpoint
ALTER TABLE "app"."exercises" DROP COLUMN "video_url";--> statement-breakpoint
ALTER TABLE "app"."muscles" DROP COLUMN "body_part_id";