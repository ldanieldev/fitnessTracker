ALTER TABLE "app"."users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "session_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_one_admin" ON "app"."users" USING btree ((true)) WHERE "app"."users"."is_admin";