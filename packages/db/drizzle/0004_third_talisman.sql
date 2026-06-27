CREATE TABLE "equipment_map" (
	"source_value" text PRIMARY KEY NOT NULL,
	"canonical" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_media" (
	"id" text PRIMARY KEY NOT NULL,
	"exercise_id" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"original_url" text,
	"width" integer,
	"height" integer,
	"order" integer DEFAULT 0 NOT NULL,
	"lang" text
);
--> statement-breakpoint
CREATE TABLE "exercise_muscles" (
	"exercise_id" text NOT NULL,
	"muscle_id" text NOT NULL,
	"role" text NOT NULL,
	"activation" double precision NOT NULL,
	CONSTRAINT "exercise_muscles_exercise_id_muscle_id_pk" PRIMARY KEY("exercise_id","muscle_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_relations" (
	"exercise_id" text NOT NULL,
	"related_id" text NOT NULL,
	"kind" text NOT NULL,
	"score" double precision NOT NULL,
	"reason" text,
	CONSTRAINT "exercise_relations_exercise_id_related_id_kind_pk" PRIMARY KEY("exercise_id","related_id","kind")
);
--> statement-breakpoint
CREATE TABLE "muscle_fatigue" (
	"owner_id" text NOT NULL,
	"muscle_id" text NOT NULL,
	"accumulated_load" double precision DEFAULT 0 NOT NULL,
	"last_trained_at" bigint,
	CONSTRAINT "muscle_fatigue_owner_id_muscle_id_pk" PRIMARY KEY("owner_id","muscle_id")
);
--> statement-breakpoint
CREATE TABLE "muscle_map" (
	"source_value" text PRIMARY KEY NOT NULL,
	"muscle_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "muscles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"canonical_group" text NOT NULL,
	"region" text,
	"svg_region" text,
	"recovery_hours" integer DEFAULT 48 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_template_days" (
	"id" text PRIMARY KEY NOT NULL,
	"program_template_id" text NOT NULL,
	"week_index" integer,
	"day_index" integer NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_template_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" text NOT NULL,
	"exercise_id" text,
	"order" integer NOT NULL,
	"sets" integer,
	"rep_scheme" text,
	"rest_seconds" integer,
	"intensity" text,
	"notes" text,
	"source_name" text
);
--> statement-breakpoint
CREATE TABLE "program_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"goal" text,
	"level" text,
	"methodology" text,
	"days_per_week" integer,
	"duration_weeks" integer,
	"equipment_needed" text[] DEFAULT '{}' NOT NULL,
	"source" text,
	"attribution" text,
	"is_public" boolean DEFAULT true NOT NULL,
	CONSTRAINT "program_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "source" text DEFAULT 'rackd' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "force" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "level" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "mechanic" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "movement_pattern" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "is_unilateral" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "body_part" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "aliases" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "popularity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_muscle_id_muscles_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_relations" ADD CONSTRAINT "exercise_relations_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_relations" ADD CONSTRAINT "exercise_relations_related_id_exercises_id_fk" FOREIGN KEY ("related_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muscle_fatigue" ADD CONSTRAINT "muscle_fatigue_muscle_id_muscles_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muscle_map" ADD CONSTRAINT "muscle_map_muscle_id_muscles_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_template_days" ADD CONSTRAINT "program_template_days_program_template_id_program_templates_id_fk" FOREIGN KEY ("program_template_id") REFERENCES "public"."program_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_template_exercises" ADD CONSTRAINT "program_template_exercises_day_id_program_template_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."program_template_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_template_exercises" ADD CONSTRAINT "program_template_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_slug_unique" UNIQUE("slug");