ALTER TABLE "app"."users" ADD COLUMN "onboarded_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "app"."users" SET "onboarded_at" = now();
