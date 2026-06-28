ALTER TABLE "routine_exercises" ADD COLUMN "bar_type" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "bar_type" text DEFAULT 'standard' NOT NULL;