-- Enable Row-Level Security on every public table (Supabase lint: rls_disabled_in_public).
-- App uses Drizzle as `postgres` (table owner) → bypasses RLS. No policies = anon/authenticated
-- get nothing via the REST API. Do NOT add FORCE ROW LEVEL SECURITY.
ALTER TABLE "body_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "body_weight_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "equipment_map" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercise_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercise_relations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "muscle_fatigue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "muscle_map" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "muscles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "personal_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "program_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "program_template_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "program_template_exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "program_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routine_exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routine_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scheduled_pushes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "set_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shared_routines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;