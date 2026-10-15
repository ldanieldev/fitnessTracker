CREATE TABLE "app"."access_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."access_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"name" varchar(60) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"prefix" varchar(8) NOT NULL,
	"last_used_at" timestamp DEFAULT null
);
--> statement-breakpoint
ALTER TABLE "app"."access_tokens" ADD CONSTRAINT "access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_token_hash" ON "app"."access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "access_token_name_per_user" ON "app"."access_tokens" USING btree ("user_id","name");