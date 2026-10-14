ALTER TABLE "app"."diary_days" ADD COLUMN "incomplete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."step_days" ADD COLUMN "partial" boolean DEFAULT false NOT NULL;