CREATE TABLE "auth_providers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_providers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	CONSTRAINT "auth_providers_provider_account_unique" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"age" integer NOT NULL,
	"sex" varchar DEFAULT null,
	"avatar_url" varchar(255) DEFAULT null,
	"is_active" boolean DEFAULT true,
	"password" varchar(255),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auth_providers" ADD CONSTRAINT "auth_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;