CREATE TABLE "app"."routine_day_skips" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."routine_day_skips_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"routine_id" integer,
	"day_id" integer,
	"day_name" varchar(255) NOT NULL,
	"skipped_on" date NOT NULL,
	"via" varchar NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."routine_day_skips" ADD CONSTRAINT "routine_day_skips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."routine_day_skips" ADD CONSTRAINT "routine_day_skips_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "app"."routines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."routine_day_skips" ADD CONSTRAINT "routine_day_skips_day_id_workout_templates_id_fk" FOREIGN KEY ("day_id") REFERENCES "app"."workout_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routine_day_skip_user_day" ON "app"."routine_day_skips" USING btree ("user_id","skipped_on");