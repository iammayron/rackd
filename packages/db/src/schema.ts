import { Schema as S } from "@triplit/client";

/**
 * Triplit schema — the local-first + sync source of truth for persisted data.
 * Domain TYPES live in @myfit/core; this maps them to storage/sync.
 * Media (clipUrl/thumbnailUrl) are URLs only — binaries live on the CDN.
 *
 * Authorization: the "user" role binds `userId` from the auth token's `sub`
 * claim (Supabase user id). Every collection carries `ownerId` and is scoped to
 * the owner. Exercises are an exception — the shared library is world-readable
 * (read has no filter); only the owner can write their custom exercises, and the
 * library itself is seeded server-side with a service token.
 */
export const roles = {
  user: {
    match: { sub: "$userId" },
  },
};

// Triplit's permission generics are finicky about tuple/readonly filters;
// the runtime shape is what matters and Triplit validates it. Cast at use.
const ownerOnly = {
  user: {
    read: { filter: [["ownerId", "=", "$role.userId"]] },
    insert: { filter: [["ownerId", "=", "$role.userId"]] },
    update: { filter: [["ownerId", "=", "$role.userId"]] },
    delete: { filter: [["ownerId", "=", "$role.userId"]] },
  },
} as never;

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
    permissions: {
      user: {
        // [id isDefined] is always-true → allow-all (shared library read + seed).
        read: { filter: [["id", "isDefined", true]] },
        insert: { filter: [["id", "isDefined", true]] },
        update: { filter: [["ownerId", "=", "$role.userId"]] }, // library has no owner → immutable
        delete: { filter: [["ownerId", "=", "$role.userId"]] },
      },
    } as never,
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
    permissions: ownerOnly,
  },

  routineExercises: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String({ default: "" }),
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
    permissions: ownerOnly,
  },

  routineSets: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String({ default: "" }),
      routineExerciseId: S.String(),
      order: S.Number(),
      type: S.String({ default: "normal" }),
      targetReps: S.Optional(S.Number()),
      targetWeight: S.Optional(S.Number()),
      targetRpe: S.Optional(S.Number()),
      tempo: S.Optional(S.String()),
    }),
    permissions: ownerOnly,
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
    permissions: ownerOnly,
  },

  sessionExercises: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String({ default: "" }),
      sessionId: S.String(),
      exerciseId: S.String(),
      order: S.Number(),
      supersetGroup: S.Optional(S.Number()),
      restSec: S.Number({ default: 120 }),
    }),
    relationships: {
      exercise: S.RelationById("exercises", "$exerciseId"),
    },
    permissions: ownerOnly,
  },

  setLogs: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String({ default: "" }),
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
    permissions: ownerOnly,
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
    permissions: ownerOnly,
  },

  bodyMetrics: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String(),
      date: S.Number(),
      weightKg: S.Number(),
      note: S.Optional(S.String()),
    }),
    permissions: ownerOnly,
  },

  // Timestamped weight history for the progress chart. Weight canonical (kg);
  // loggedAt is epoch ms. Many rows per user, owner-scoped.
  bodyWeightLogs: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String(),
      weightKg: S.Number(),
      loggedAt: S.Number(),
    }),
    permissions: ownerOnly,
  },

  programs: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String(),
      name: S.String(),
      notes: S.Optional(S.String()),
      order: S.Number({ default: 0 }),
    }),
    permissions: ownerOnly,
  },

  // Public catalog of shared routines (a self-contained snapshot for discovery).
  // Read-open to all authed users; only the author can edit/remove their own.
  sharedRoutines: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String(),
      authorName: S.String({ default: "Someone" }),
      name: S.String(),
      exercisesJson: S.String(),
      exerciseCount: S.Number({ default: 0 }),
      createdAt: S.Number(),
    }),
    permissions: {
      user: {
        read: { filter: [["id", "isDefined", true]] },
        insert: { filter: [["ownerId", "=", "$role.userId"]] },
        update: { filter: [["ownerId", "=", "$role.userId"]] },
        delete: { filter: [["ownerId", "=", "$role.userId"]] },
      },
    } as never,
  },

  // Profile + settings, one row per user. Weights canonical (kg), height in cm.
  // photoUrl is a URL only — no binary in the synced DB (media rule).
  userProfile: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String(),
      displayName: S.Optional(S.String()),
      photoUrl: S.Optional(S.String()),
      heightCm: S.Optional(S.Number()),
      currentWeightKg: S.Optional(S.Number()),
      goalWeightKg: S.Optional(S.Number()),
      trainingGoal: S.Optional(S.String()),
      unitPreference: S.String({ default: "metric" }),
      defaultRestSec: S.Number({ default: 120 }),
      defaultSets: S.Number({ default: 3 }),
      defaultReps: S.Number({ default: 10 }),
    }),
    permissions: ownerOnly,
  },

  programDays: {
    schema: S.Schema({
      id: S.Id(),
      ownerId: S.String({ default: "" }),
      programId: S.String(),
      order: S.Number(),
      name: S.String({ default: "Day" }),
      routineId: S.Optional(S.String()),
    }),
    relationships: {
      routine: S.RelationById("routines", "$routineId"),
    },
    permissions: ownerOnly,
  },
});

export type Schema = typeof schema;
