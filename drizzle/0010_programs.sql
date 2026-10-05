ALTER TABLE "app"."program_workouts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."user_program_workout_completions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "app"."program_workouts" CASCADE;--> statement-breakpoint
DROP TABLE "app"."user_program_workout_completions" CASCADE;--> statement-breakpoint
ALTER TABLE "app"."programs" DROP CONSTRAINT "programs_created_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" ADD COLUMN "enrollment_id" integer;--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" ADD COLUMN "program_phase_id" integer;--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" ADD COLUMN "program_week" smallint DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."program_phases" ADD COLUMN "weeks" smallint NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."program_phases" ADD COLUMN "routine_id" integer;--> statement-breakpoint
ALTER TABLE "app"."program_phases" ADD COLUMN "deload" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."programs" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."user_program_enrollments" ADD COLUMN "anchor_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."user_program_enrollments" ADD COLUMN "anchor_week" smallint NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."user_program_enrollments" ADD COLUMN "paused_week" smallint DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."user_program_enrollments" ADD COLUMN "current_phase_id" integer;--> statement-breakpoint
ALTER TABLE "app"."user_program_enrollments" ADD COLUMN "notice" varchar DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" ADD CONSTRAINT "workout_sessions_enrollment_id_user_program_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "app"."user_program_enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."workout_sessions" ADD CONSTRAINT "workout_sessions_program_phase_id_program_phases_id_fk" FOREIGN KEY ("program_phase_id") REFERENCES "app"."program_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."program_phases" ADD CONSTRAINT "program_phases_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "app"."routines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."programs" ADD CONSTRAINT "programs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_program_enrollments" ADD CONSTRAINT "user_program_enrollments_current_phase_id_program_phases_id_fk" FOREIGN KEY ("current_phase_id") REFERENCES "app"."program_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "program_phase_program" ON "app"."program_phases" USING btree ("program_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_one_live" ON "app"."user_program_enrollments" USING btree ("user_id") WHERE status in ('active', 'paused');--> statement-breakpoint
ALTER TABLE "app"."program_phases" DROP COLUMN "week_start";--> statement-breakpoint
ALTER TABLE "app"."program_phases" DROP COLUMN "week_end";--> statement-breakpoint
ALTER TABLE "app"."programs" DROP COLUMN "image_url";--> statement-breakpoint
ALTER TABLE "app"."programs" DROP COLUMN "total_weeks";--> statement-breakpoint
ALTER TABLE "app"."programs" DROP COLUMN "created_by_user_id";--> statement-breakpoint
ALTER TABLE "app"."user_program_enrollments" DROP COLUMN "start_date";--> statement-breakpoint
ALTER TABLE "app"."program_phases" ADD CONSTRAINT "program_phases_weeks_check" CHECK ("app"."program_phases"."weeks" >= 1);