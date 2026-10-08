CREATE INDEX "program_user" ON "app"."programs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "enrollment_program" ON "app"."user_program_enrollments" USING btree ("program_id");