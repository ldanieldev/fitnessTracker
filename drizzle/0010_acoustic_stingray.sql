CREATE TABLE "app"."import_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."import_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"source" varchar NOT NULL,
	"status" varchar DEFAULT 'queued' NOT NULL,
	"file_count" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb DEFAULT null,
	"error" text DEFAULT null
);
--> statement-breakpoint
ALTER TABLE "app"."diary_entries" ADD COLUMN "import_key" varchar(64) DEFAULT null;--> statement-breakpoint
ALTER TABLE "app"."import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "diary_entry_import_key_unique" ON "app"."diary_entries" USING btree ("import_key") WHERE import_key is not null;