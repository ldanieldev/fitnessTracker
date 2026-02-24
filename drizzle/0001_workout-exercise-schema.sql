CREATE TABLE "body_parts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "body_parts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"name" varchar(255) NOT NULL,
	"image_url" varchar(255) DEFAULT null,
	CONSTRAINT "body_part_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "equipment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"name" varchar(255) NOT NULL,
	CONSTRAINT "equipment_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "exercise_equipment" (
	"exercise_id" integer NOT NULL,
	"equipment_id" integer NOT NULL,
	CONSTRAINT "exercise_equipment_exercise_id_equipment_id_pk" PRIMARY KEY("exercise_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_muscles" (
	"exercise_id" integer NOT NULL,
	"muscle_id" integer NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	CONSTRAINT "exercise_muscles_exercise_id_muscle_id_pk" PRIMARY KEY("exercise_id","muscle_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exercise_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"name" varchar(255) NOT NULL,
	CONSTRAINT "exercise_type_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exercises_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"name" varchar(255) NOT NULL,
	"exercise_type_id" integer DEFAULT null,
	"difficulty" varchar DEFAULT null,
	"image_url" varchar(255) DEFAULT null,
	"video_url" varchar(255) DEFAULT null,
	"instructions" jsonb DEFAULT null,
	"created_by_user_id" integer DEFAULT null,
	CONSTRAINT "exercise_name_user" UNIQUE("name","created_by_user_id")
);
--> statement-breakpoint
CREATE TABLE "muscles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "muscles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"name" varchar(255) NOT NULL,
	"body_part_id" integer NOT NULL,
	CONSTRAINT "muscle_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "workout_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workout_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"session_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"entry_type" varchar NOT NULL,
	"duration_seconds" integer DEFAULT null,
	"distance_meters" numeric DEFAULT null,
	"calories" integer DEFAULT null,
	"avg_pace" numeric DEFAULT null,
	"notes" text DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workout_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"template_id" integer DEFAULT null,
	"name" varchar(255) DEFAULT null,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp DEFAULT null,
	"notes" text DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workout_sets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"entry_id" integer NOT NULL,
	"set_number" integer NOT NULL,
	"weight" numeric NOT NULL,
	"reps" integer NOT NULL,
	"rpe" integer DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "workout_template_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workout_template_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"template_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"entry_type" varchar NOT NULL,
	"target_sets" integer DEFAULT null,
	"target_reps" integer DEFAULT null,
	"target_weight" numeric DEFAULT null,
	"target_duration_seconds" integer DEFAULT null,
	"target_distance_meters" numeric DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "workout_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workout_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "program_phases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "program_phases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"program_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"sort_order" integer NOT NULL,
	"week_start" integer NOT NULL,
	"week_end" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_workouts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "program_workouts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"phase_id" integer NOT NULL,
	"template_id" integer DEFAULT null,
	"name" varchar(255) NOT NULL,
	"day_of_week" integer DEFAULT null,
	"week_number" integer NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "programs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT null,
	"image_url" varchar(255) DEFAULT null,
	"total_weeks" integer NOT NULL,
	"created_by_user_id" integer DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "user_program_enrollments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_program_enrollments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"program_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"status" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_program_workout_completions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_program_workout_completions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"enrollment_id" integer NOT NULL,
	"program_workout_id" integer NOT NULL,
	"session_id" integer DEFAULT null,
	"completion_percent" integer DEFAULT 100 NOT NULL,
	"completed_at" timestamp NOT NULL,
	CONSTRAINT "enrollment_workout_unique" UNIQUE("enrollment_id","program_workout_id")
);
--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_muscle_id_muscles_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_exercise_type_id_exercise_types_id_fk" FOREIGN KEY ("exercise_type_id") REFERENCES "public"."exercise_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muscles" ADD CONSTRAINT "muscles_body_part_id_body_parts_id_fk" FOREIGN KEY ("body_part_id") REFERENCES "public"."body_parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_entries" ADD CONSTRAINT "workout_entries_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_entries" ADD CONSTRAINT "workout_entries_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_entry_id_workout_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."workout_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_entries" ADD CONSTRAINT "workout_template_entries_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_entries" ADD CONSTRAINT "workout_template_entries_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_phases" ADD CONSTRAINT "program_phases_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_workouts" ADD CONSTRAINT "program_workouts_phase_id_program_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."program_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_workouts" ADD CONSTRAINT "program_workouts_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_program_enrollments" ADD CONSTRAINT "user_program_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_program_enrollments" ADD CONSTRAINT "user_program_enrollments_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_program_workout_completions" ADD CONSTRAINT "user_program_workout_completions_enrollment_id_user_program_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."user_program_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_program_workout_completions" ADD CONSTRAINT "user_program_workout_completions_program_workout_id_program_workouts_id_fk" FOREIGN KEY ("program_workout_id") REFERENCES "public"."program_workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_program_workout_completions" ADD CONSTRAINT "user_program_workout_completions_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE set null ON UPDATE no action;