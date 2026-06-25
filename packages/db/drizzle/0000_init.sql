CREATE TABLE "body_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"date" bigint NOT NULL,
	"weight_kg" double precision NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "body_weight_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"weight_kg" double precision NOT NULL,
	"logged_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"primary_muscle" text NOT NULL,
	"secondary_muscles" text[] DEFAULT '{}' NOT NULL,
	"equipment" text NOT NULL,
	"category" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"thumbnail_url" text,
	"clip_url" text,
	"clip_url_webm" text,
	"media_source" text DEFAULT 'library' NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"owner_id" text
);
--> statement-breakpoint
CREATE TABLE "personal_records" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"type" text NOT NULL,
	"value" double precision NOT NULL,
	"session_id" text NOT NULL,
	"achieved_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_days" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text DEFAULT '' NOT NULL,
	"program_id" text NOT NULL,
	"order" integer NOT NULL,
	"name" text DEFAULT 'Day' NOT NULL,
	"routine_id" text,
	"weekday" integer
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"order" integer DEFAULT 0 NOT NULL,
	"block_weeks" integer,
	"active" boolean,
	"schedule_mode" text,
	"rotation_cursor" integer
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text DEFAULT '' NOT NULL,
	"routine_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"order" integer NOT NULL,
	"superset_group" integer,
	"rest_sec" integer DEFAULT 120 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "routine_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text DEFAULT '' NOT NULL,
	"routine_exercise_id" text NOT NULL,
	"order" integer NOT NULL,
	"type" text DEFAULT 'normal' NOT NULL,
	"target_reps" integer,
	"target_weight" double precision,
	"target_rpe" double precision,
	"tempo" text
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"folder_id" text,
	"notes" text,
	"order" integer DEFAULT 0 NOT NULL,
	"category" text,
	"scheduled_days" integer[]
);
--> statement-breakpoint
CREATE TABLE "scheduled_pushes" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"fire_at" bigint NOT NULL,
	"title" text DEFAULT 'Rest over' NOT NULL,
	"body" text DEFAULT 'Time for your next set.' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text DEFAULT '' NOT NULL,
	"session_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"order" integer NOT NULL,
	"superset_group" integer,
	"rest_sec" integer DEFAULT 120 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"routine_id" text,
	"name" text NOT NULL,
	"started_at" bigint NOT NULL,
	"ended_at" bigint,
	"notes" text,
	"bodyweight" double precision
);
--> statement-breakpoint
CREATE TABLE "set_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text DEFAULT '' NOT NULL,
	"session_exercise_id" text NOT NULL,
	"order" integer NOT NULL,
	"type" text DEFAULT 'normal' NOT NULL,
	"weight" double precision DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"rpe" double precision,
	"completed" boolean DEFAULT false NOT NULL,
	"rest_taken_sec" integer,
	"is_pr" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_routines" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"author_name" text DEFAULT 'Someone' NOT NULL,
	"name" text NOT NULL,
	"exercises_json" text NOT NULL,
	"exercise_count" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"display_name" text,
	"photo_url" text,
	"height_cm" double precision,
	"current_weight_kg" double precision,
	"goal_weight_kg" double precision,
	"training_goal" text,
	"unit_preference" text DEFAULT 'metric' NOT NULL,
	"default_rest_sec" integer DEFAULT 120 NOT NULL,
	"default_sets" integer DEFAULT 3 NOT NULL,
	"default_reps" integer DEFAULT 10 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_sets" ADD CONSTRAINT "routine_sets_routine_exercise_id_routine_exercises_id_fk" FOREIGN KEY ("routine_exercise_id") REFERENCES "public"."routine_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_pushes" ADD CONSTRAINT "scheduled_pushes_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_session_exercise_id_session_exercises_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercises"("id") ON DELETE cascade ON UPDATE no action;