-- Fails on users_email_unique if two accounts differ only by case; merge or rename one by hand, then re-run.
UPDATE "app"."users" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));--> statement-breakpoint
UPDATE "app"."auth_providers" SET "provider_account_id" = lower(btrim("provider_account_id")) WHERE "provider" = 'credentials' AND "provider_account_id" <> lower(btrim("provider_account_id"));--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_email_normalized_check" CHECK ("app"."users"."email" = lower(btrim("app"."users"."email")));