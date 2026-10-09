ALTER TABLE "app"."users" ADD COLUMN "show_body" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "show_workouts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "show_nutrition" boolean DEFAULT true NOT NULL;