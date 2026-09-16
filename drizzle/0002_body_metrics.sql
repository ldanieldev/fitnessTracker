CREATE TABLE "app"."measurement_type_prefs" (
	"user_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT null,
	CONSTRAINT "measurement_type_prefs_user_id_type_id_pk" PRIMARY KEY("user_id","type_id")
);
--> statement-breakpoint
CREATE TABLE "app"."measurement_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."measurement_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer DEFAULT null,
	"key" varchar(64) DEFAULT null,
	"name" varchar(64) NOT NULL,
	"unit" varchar(16) NOT NULL,
	"precision" smallint DEFAULT 1 NOT NULL,
	"direction" varchar DEFAULT 'neutral' NOT NULL,
	"deleted_at" timestamp DEFAULT null
);
--> statement-breakpoint
CREATE TABLE "app"."measurements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."measurements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"value" numeric NOT NULL,
	"measured_at" timestamp DEFAULT now() NOT NULL,
	"measured_on" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."measurement_goals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."measurement_goals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"target_value" numeric NOT NULL,
	"target_date" date DEFAULT null,
	"start_value" numeric NOT NULL,
	"start_date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."measurement_type_prefs" ADD CONSTRAINT "measurement_type_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."measurement_type_prefs" ADD CONSTRAINT "measurement_type_prefs_type_id_measurement_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "app"."measurement_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."measurement_types" ADD CONSTRAINT "measurement_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."measurements" ADD CONSTRAINT "measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."measurements" ADD CONSTRAINT "measurements_type_id_measurement_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "app"."measurement_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."measurement_goals" ADD CONSTRAINT "measurement_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."measurement_goals" ADD CONSTRAINT "measurement_goals_type_id_measurement_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "app"."measurement_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_type_builtin_key" ON "app"."measurement_types" USING btree ("key") WHERE user_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_type_user_name" ON "app"."measurement_types" USING btree ("user_id",lower(name)) WHERE user_id is not null and deleted_at is null;--> statement-breakpoint
CREATE INDEX "measurement_user_type_day" ON "app"."measurements" USING btree ("user_id","type_id","measured_on");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_goal_one_per_type" ON "app"."measurement_goals" USING btree ("user_id","type_id");
--> statement-breakpoint
INSERT INTO "app"."measurement_types" ("user_id", "key", "name", "unit", "precision", "direction") VALUES
  (NULL, 'bodyweight', 'Bodyweight', 'lbs', 1, 'neutral'),
  (NULL, 'body_fat', 'Body Fat', '%', 2, 'lower'),
  (NULL, 'waist', 'Waist', 'in', 1, 'lower')
ON CONFLICT ("key") WHERE user_id IS NULL DO UPDATE SET
  "name" = excluded."name",
  "unit" = excluded."unit",
  "precision" = excluded."precision",
  "direction" = excluded."direction";