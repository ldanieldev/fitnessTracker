CREATE TABLE "app"."step_days" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."step_days_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"day" date NOT NULL,
	"steps" integer NOT NULL,
	"source" varchar(16) DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."step_targets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."step_targets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"daily_target" integer NOT NULL,
	"effective_from" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."step_days" ADD CONSTRAINT "step_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."step_targets" ADD CONSTRAINT "step_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "step_day_one_per_day" ON "app"."step_days" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "step_target_one_per_date" ON "app"."step_targets" USING btree ("user_id","effective_from");