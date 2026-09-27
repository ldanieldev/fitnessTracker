CREATE TABLE "app"."workout_exercise_rollups" (
	"session_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"performed_on" date NOT NULL,
	"tracking_type" varchar NOT NULL,
	"load_style" varchar,
	"set_count" integer NOT NULL,
	"total_reps" integer NOT NULL,
	"total_volume" numeric,
	"top_weight" numeric,
	"top_weight_reps" integer,
	"top_set_volume" numeric,
	"best_e1rm" numeric,
	"weight_by_reps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_distance_meters" numeric,
	"total_duration_seconds" integer,
	"best_pace" numeric,
	CONSTRAINT "workout_exercise_rollups_session_id_exercise_id_pk" PRIMARY KEY("session_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "app"."workout_exercise_goals" (
	"user_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"metric" varchar NOT NULL,
	"target_value" numeric NOT NULL,
	"target_reps" integer,
	"target_date" date,
	"achieved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workout_exercise_goals_user_id_exercise_id_metric_pk" PRIMARY KEY("user_id","exercise_id","metric")
);
--> statement-breakpoint
ALTER TABLE "app"."workout_exercise_rollups" ADD CONSTRAINT "workout_exercise_rollups_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "app"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."workout_exercise_rollups" ADD CONSTRAINT "workout_exercise_rollups_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "app"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."workout_exercise_rollups" ADD CONSTRAINT "workout_exercise_rollups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."workout_exercise_goals" ADD CONSTRAINT "workout_exercise_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."workout_exercise_goals" ADD CONSTRAINT "workout_exercise_goals_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "app"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_rollup_series" ON "app"."workout_exercise_rollups" USING btree ("user_id","exercise_id","performed_on");--> statement-breakpoint
ALTER TABLE "app"."exercise_prefs" ADD COLUMN "default_graph" varchar;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "one_rep_max_rep_cap" smallint DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_one_rep_max_rep_cap_check" CHECK ("one_rep_max_rep_cap" between 1 and 20);
