CREATE TABLE "app"."goal_target_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."goal_target_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"user_id" integer NOT NULL,
	"effective_from" date NOT NULL,
	"profile_id" integer DEFAULT null,
	"profile_name" varchar(255) DEFAULT null,
	"calories" numeric DEFAULT null,
	"targets" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."goal_target_history" ADD CONSTRAINT "goal_target_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."goal_target_history" ADD CONSTRAINT "goal_target_history_profile_id_goal_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "app"."goal_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "goal_target_history_one_per_day" ON "app"."goal_target_history" USING btree ("user_id","effective_from");--> statement-breakpoint
INSERT INTO "app"."goal_target_history" ("user_id", "effective_from", "profile_id", "profile_name", "calories", "targets")
  SELECT gp."user_id", DATE '1900-01-01', gp."id", gp."name", gp."calories",
    coalesce(
      jsonb_agg(jsonb_build_object('key', n."key", 'amount', gpt."amount", 'direction', gpt."direction"))
        FILTER (WHERE n."key" IS NOT NULL),
      '[]'::jsonb
    )
  FROM "app"."goal_profiles" gp
  LEFT JOIN "app"."goal_profile_targets" gpt ON gpt."profile_id" = gp."id"
  LEFT JOIN "app"."nutrients" n ON n."id" = gpt."nutrient_id"
  WHERE gp."is_default" AND gp."deleted_at" IS NULL
  GROUP BY gp."id";
