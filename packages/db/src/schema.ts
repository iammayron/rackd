import { Schema as S } from "@triplit/client";

/**
 * Triplit schema — the local-first + sync source of truth for persisted data.
 * Domain TYPES live in @fitnow/core; this maps them to storage/sync.
 * Media (clipUrl/thumbnailUrl) are URLs only — binaries live on the CDN,
 * never in the synced DB.
 */
export const schema = S.Collections({
  exercises: {
    schema: S.Schema({
      id: S.Id(),
      name: S.String(),
      primaryMuscle: S.String(),
      secondaryMuscles: S.Set(S.String()),
      equipment: S.String(),
      category: S.String(),
      instructions: S.String({ default: "" }),
      thumbnailUrl: S.Optional(S.String()),
      clipUrl: S.Optional(S.String()),
      clipUrlWebm: S.Optional(S.String()),
      mediaSource: S.String({ default: "library" }),
      isCustom: S.Boolean({ default: false }),
      ownerId: S.Optional(S.String()),
    }),
  },

  routines: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String(),
      name: S.String(),
      folderId: S.Optional(S.String()),
      notes: S.Optional(S.String()),
      order: S.Number({ default: 0 }),
    }),
  },

  routineExercises: {
    schema: S.Schema({
      id: S.Id(),
      routineId: S.String(),
      exerciseId: S.String(),
      order: S.Number(),
      supersetGroup: S.Optional(S.Number()),
      restSec: S.Number({ default: 120 }),
      notes: S.Optional(S.String()),
    }),
    relationships: {
      exercise: S.RelationById("exercises", "$exerciseId"),
    },
  },

  routineSets: {
    schema: S.Schema({
      id: S.Id(),
      routineExerciseId: S.String(),
      order: S.Number(),
      type: S.String({ default: "normal" }),
      targetReps: S.Optional(S.Number()),
      targetWeight: S.Optional(S.Number()),
      targetRpe: S.Optional(S.Number()),
      tempo: S.Optional(S.String()),
    }),
  },

  sessions: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String(),
      routineId: S.Optional(S.String()),
      name: S.String(),
      startedAt: S.Number(),
      endedAt: S.Optional(S.Number()),
      notes: S.Optional(S.String()),
      bodyweight: S.Optional(S.Number()),
    }),
  },

  sessionExercises: {
    schema: S.Schema({
      id: S.Id(),
      sessionId: S.String(),
      exerciseId: S.String(),
      order: S.Number(),
      supersetGroup: S.Optional(S.Number()),
      restSec: S.Number({ default: 120 }),
    }),
    relationships: {
      exercise: S.RelationById("exercises", "$exerciseId"),
    },
  },

  setLogs: {
    schema: S.Schema({
      id: S.Id(),
      sessionExerciseId: S.String(),
      order: S.Number(),
      type: S.String({ default: "normal" }),
      weight: S.Number({ default: 0 }),
      reps: S.Number({ default: 0 }),
      rpe: S.Optional(S.Number()),
      completed: S.Boolean({ default: false }),
      restTakenSec: S.Optional(S.Number()),
      isPr: S.Boolean({ default: false }),
    }),
  },

  personalRecords: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String(),
      exerciseId: S.String(),
      type: S.String(),
      value: S.Number(),
      sessionId: S.String(),
      achievedAt: S.Number(),
    }),
  },

  bodyMetrics: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String(),
      date: S.Number(),
      weightKg: S.Number(),
      note: S.Optional(S.String()),
    }),
  },
});

export type Schema = typeof schema;
