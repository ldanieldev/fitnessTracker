CREATE TABLE "app"."day_notes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."day_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"day" date NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."day_notes" ADD CONSTRAINT "day_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "day_note_one_per_day" ON "app"."day_notes" USING btree ("user_id","day");--> statement-breakpoint
INSERT INTO "app"."day_notes" ("user_id", "day", "body")
  SELECT "user_id", "date", "notes" FROM "app"."diary_days" WHERE nullif(btrim("notes"), '') IS NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."diary_days" DROP COLUMN "notes";