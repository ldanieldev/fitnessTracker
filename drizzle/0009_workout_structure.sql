CREATE TABLE "app"."routines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."routines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"notes" text DEFAULT null,
	"active" boolean DEFAULT false NOT NULL,
	"next_day_id" integer
);
--> statement-breakpoint
ALTER TABLE "app"."users" DROP CONSTRAINT "users_plate_sizes_check";--> statement-breakpoint
ALTER TABLE "app"."exercise_prefs" DROP CONSTRAINT "exercise_prefs_plate_sizes_check";--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" DROP CONSTRAINT "workout_template_entries_exercise_id_exercises_id_fk";
--> statement-breakpoint
ALTER TABLE "app"."workout_entries" ADD COLUMN "target_sets" integer DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_entries" ADD COLUMN "target_low" numeric DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_entries" ADD COLUMN "target_high" numeric DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_entries" ADD COLUMN "target_weight" numeric DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_entries" ADD COLUMN "superset_group" smallint DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_entries" ADD COLUMN "optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."workout_entries" ADD COLUMN "rest_seconds" integer DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" ADD COLUMN "routine_day_id" integer;--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" ADD COLUMN "target_low" numeric DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" ADD COLUMN "target_high" numeric DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" ADD COLUMN "superset_group" smallint DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" ADD COLUMN "optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" ADD COLUMN "rest_seconds" integer DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" ADD COLUMN "notes" varchar(500) DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_templates" ADD COLUMN "routine_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."workout_templates" ADD COLUMN "sort_order" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."workout_templates" ADD COLUMN "floating" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."routines" ADD CONSTRAINT "routines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."routines" ADD CONSTRAINT "routines_next_day_id_workout_templates_id_fk" FOREIGN KEY ("next_day_id") REFERENCES "app"."workout_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "routine_one_active" ON "app"."routines" USING btree ("user_id") WHERE active;--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" ADD CONSTRAINT "workout_sessions_routine_day_id_workout_templates_id_fk" FOREIGN KEY ("routine_day_id") REFERENCES "app"."workout_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" ADD CONSTRAINT "workout_template_entries_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "app"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."workout_templates" ADD CONSTRAINT "workout_templates_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "app"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_template_entry_template" ON "app"."workout_template_entries" USING btree ("template_id","sort_order");--> statement-breakpoint
CREATE INDEX "workout_template_routine" ON "app"."workout_templates" USING btree ("routine_id","sort_order");--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" DROP COLUMN "entry_type";--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" DROP COLUMN "target_reps";--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" DROP COLUMN "target_duration_seconds";--> statement-breakpoint
ALTER TABLE "app"."workout_template_entries" DROP COLUMN "target_distance_meters";--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_plate_sizes_check" CHECK (cardinality("app"."users"."plate_sizes") between 1 and 12
        and 0 < all("app"."users"."plate_sizes") and 100 >= all("app"."users"."plate_sizes"));--> statement-breakpoint
ALTER TABLE "app"."exercise_prefs" ADD CONSTRAINT "exercise_prefs_plate_sizes_check" CHECK ("app"."exercise_prefs"."plate_sizes" is null or (
        cardinality("app"."exercise_prefs"."plate_sizes") between 1 and 12
        and 0 < all("app"."exercise_prefs"."plate_sizes") and 100 >= all("app"."exercise_prefs"."plate_sizes")
      ));