CREATE TABLE "app"."google_health_connections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."google_health_connections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"google_sub" varchar(255) NOT NULL,
	"google_email" varchar(320) NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"scopes" text[] NOT NULL,
	"sync_steps" boolean DEFAULT false NOT NULL,
	"push_weight" boolean DEFAULT false NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"sync_started_at" timestamp DEFAULT null,
	"last_synced_at" timestamp DEFAULT null,
	"last_error" text DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "app"."sleep_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."sleep_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"google_id" varchar(255) NOT NULL,
	"day" date NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"main_sleep" boolean NOT NULL,
	"minutes_asleep" integer NOT NULL,
	"minutes_awake" integer NOT NULL,
	"minutes_light" integer NOT NULL,
	"minutes_deep" integer NOT NULL,
	"minutes_rem" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."measurements" ADD COLUMN "source" varchar DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."measurements" ADD COLUMN "external_id" varchar(255) DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."google_health_connections" ADD CONSTRAINT "google_health_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sleep_sessions" ADD CONSTRAINT "sleep_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "google_health_connection_user" ON "app"."google_health_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sleep_session_google_id" ON "app"."sleep_sessions" USING btree ("user_id","google_id");--> statement-breakpoint
CREATE INDEX "sleep_session_user_day" ON "app"."sleep_sessions" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_google_one_per_day" ON "app"."measurements" USING btree ("user_id","type_id","measured_on") WHERE source = 'google';
--> statement-breakpoint
INSERT INTO "app"."measurement_types" ("user_id", "key", "name", "unit", "precision", "direction") VALUES
  (NULL, 'hrv', 'HRV', 'ms', 0, 'higher'),
  (NULL, 'resting_hr', 'Resting HR', 'bpm', 0, 'lower')
ON CONFLICT ("key") WHERE user_id IS NULL DO UPDATE SET
  "name" = excluded."name",
  "unit" = excluded."unit",
  "precision" = excluded."precision",
  "direction" = excluded."direction";
