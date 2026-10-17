ALTER TABLE "app"."meal_containers" DROP CONSTRAINT "meal_container_user_name_unique";--> statement-breakpoint
CREATE INDEX "auth_provider_user" ON "app"."auth_providers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "food_serving_food" ON "app"."food_servings" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "goal_profile_user" ON "app"."goal_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredient_recipe" ON "app"."recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredient_food" ON "app"."recipe_ingredients" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "saved_meal_item_meal" ON "app"."saved_meal_items" USING btree ("saved_meal_id");--> statement-breakpoint
CREATE INDEX "diary_entry_food" ON "app"."diary_entries" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "diary_entry_recipe" ON "app"."diary_entries" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_container_user_name_unique" ON "app"."meal_containers" USING btree ("user_id","name") WHERE not is_archived;--> statement-breakpoint
CREATE INDEX "import_job_user" ON "app"."import_jobs" USING btree ("user_id");