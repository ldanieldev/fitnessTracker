ALTER TABLE "app"."workout_entries" DROP CONSTRAINT "workout_entries_exercise_id_exercises_id_fk";
--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" DROP CONSTRAINT "workout_sessions_template_id_workout_templates_id_fk";
--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" ALTER COLUMN "started_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "app"."workout_sets" ALTER COLUMN "weight" SET DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_sets" ALTER COLUMN "weight" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."workout_sets" ALTER COLUMN "reps" SET DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_sets" ALTER COLUMN "reps" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."workout_entries" ADD COLUMN "tracking_type" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."workout_entries" ADD COLUMN "load_style" varchar DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" ADD COLUMN "performed_on" date NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" ADD COLUMN "ended_at" timestamp DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_sets" ADD COLUMN "sort_order" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."workout_sets" ADD COLUMN "distance_meters" numeric DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_sets" ADD COLUMN "duration_seconds" integer DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_sets" ADD COLUMN "done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."workout_sets" ADD COLUMN "comment" varchar(500) DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_entries" ADD CONSTRAINT "workout_entries_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "app"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_entry_exercise" ON "app"."workout_entries" USING btree ("exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_session_open" ON "app"."workout_sessions" USING btree ("user_id") WHERE ended_at is null;--> statement-breakpoint
CREATE INDEX "workout_session_recent" ON "app"."workout_sessions" USING btree ("user_id","performed_on","id");--> statement-breakpoint
CREATE INDEX "workout_set_entry" ON "app"."workout_sets" USING btree ("entry_id","sort_order");--> statement-breakpoint
ALTER TABLE "app"."workout_entries" DROP COLUMN "entry_type";--> statement-breakpoint
ALTER TABLE "app"."workout_entries" DROP COLUMN "duration_seconds";--> statement-breakpoint
ALTER TABLE "app"."workout_entries" DROP COLUMN "distance_meters";--> statement-breakpoint
ALTER TABLE "app"."workout_entries" DROP COLUMN "calories";--> statement-breakpoint
ALTER TABLE "app"."workout_entries" DROP COLUMN "avg_pace";--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" DROP COLUMN "template_id";--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" DROP COLUMN "completed_at";--> statement-breakpoint
ALTER TABLE "app"."workout_sets" DROP COLUMN "set_number";--> statement-breakpoint
ALTER TABLE "app"."workout_sets" DROP COLUMN "rpe";