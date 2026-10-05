import { MUSCLE_TAXONOMY } from "@rackd/core";

export interface MockRow extends Record<string, any> {
  id: string;
}

const SEED_EXERCISES: any[] = [
  { id: "barbell-bench-press-medium-grip", name: "Barbell Bench Press", primary_muscle: "chest", equipment: "barbell", category: "barbell" },
  { id: "dumbbell-bench-press", name: "Dumbbell Bench Press", primary_muscle: "chest", equipment: "dumbbell", category: "dumbbell" },
  { id: "incline-dumbbell-press", name: "Incline Dumbbell Press", primary_muscle: "chest", equipment: "dumbbell", category: "dumbbell" },
  { id: "cable-crossover", name: "Cable Chest Fly", primary_muscle: "chest", equipment: "cable", category: "machine" },
  { id: "barbell-shoulder-press", name: "Overhead Press", primary_muscle: "shoulders", equipment: "barbell", category: "barbell" },
  { id: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press", primary_muscle: "shoulders", equipment: "dumbbell", category: "dumbbell" },
  { id: "side-lateral-raise", name: "Lateral Raise", primary_muscle: "shoulders", equipment: "dumbbell", category: "dumbbell" },
  { id: "cable-seated-lateral-raise", name: "Cable Lateral Raise", primary_muscle: "shoulders", equipment: "cable", category: "machine" },
  { id: "reverse-machine-flyes", name: "Reverse Pec Deck", primary_muscle: "shoulders", equipment: "machine", category: "machine" },
  { id: "face-pull", name: "Face Pull", primary_muscle: "shoulders", equipment: "cable", category: "machine" },
  { id: "triceps-pushdown", name: "Tricep Pushdown", primary_muscle: "triceps", equipment: "cable", category: "machine" },
  { id: "standing-overhead-barbell-triceps-extension", name: "Overhead Barbell Tricep Extension", primary_muscle: "triceps", equipment: "barbell", category: "barbell" },
  { id: "cable-rope-overhead-triceps-extension", name: "Overhead Cable Tricep Extension", primary_muscle: "triceps", equipment: "cable", category: "machine" },
  { id: "lying-dumbbell-tricep-extension", name: "Dumbbell Skullcrusher", primary_muscle: "triceps", equipment: "dumbbell", category: "dumbbell" },
  { id: "pullups", name: "Pull-up", primary_muscle: "back", equipment: "bodyweight", category: "bodyweight" },
  { id: "wide-grip-lat-pulldown", name: "Lat Pulldown", primary_muscle: "back", equipment: "cable", category: "machine" },
  { id: "bent-over-barbell-row", name: "Barbell Row", primary_muscle: "back", equipment: "barbell", category: "barbell" },
  { id: "seated-cable-rows", name: "Seated Cable Row", primary_muscle: "back", equipment: "cable", category: "machine" },
  { id: "one-arm-dumbbell-row", name: "Single Arm DB Row", primary_muscle: "back", equipment: "dumbbell", category: "dumbbell" },
  { id: "straight-arm-pulldown", name: "Straight Arm Pulldown", primary_muscle: "back", equipment: "cable", category: "machine" },
  { id: "barbell-deadlift", name: "Deadlift", primary_muscle: "back", equipment: "barbell", category: "barbell" },
  { id: "sumo-deadlift", name: "Sumo Deadlift", primary_muscle: "back", equipment: "barbell", category: "barbell" },
  { id: "romanian-deadlift", name: "Romanian Deadlift", primary_muscle: "hamstrings", equipment: "barbell", category: "barbell" },
  { id: "barbell-curl", name: "Barbell Bicep Curl", primary_muscle: "biceps", equipment: "barbell", category: "barbell" },
  { id: "dumbbell-bicep-curl", name: "Dumbbell Bicep Curl", primary_muscle: "biceps", equipment: "dumbbell", category: "dumbbell" },
  { id: "hammer-curls", name: "Hammer Curl", primary_muscle: "biceps", equipment: "dumbbell", category: "dumbbell" },
  { id: "incline-dumbbell-curl", name: "Incline Dumbbell Curl", primary_muscle: "biceps", equipment: "dumbbell", category: "dumbbell" },
  { id: "standing-biceps-cable-curl", name: "Cable Bicep Curl", primary_muscle: "biceps", equipment: "cable", category: "machine" },
  { id: "barbell-squat", name: "Barbell Squat", primary_muscle: "quads", equipment: "barbell", category: "barbell" },
  { id: "front-barbell-squat", name: "Front Squat", primary_muscle: "quads", equipment: "barbell", category: "barbell" },
  { id: "hack-squat", name: "Hack Squat", primary_muscle: "quads", equipment: "machine", category: "machine" },
  { id: "split-squat-with-dumbbells", name: "Bulgarian Split Squat", primary_muscle: "quads", equipment: "dumbbell", category: "dumbbell" },
  { id: "leg-press", name: "Leg Press", primary_muscle: "quads", equipment: "machine", category: "machine" },
  { id: "leg-extensions", name: "Leg Extension", primary_muscle: "quads", equipment: "machine", category: "machine" },
  { id: "lying-leg-curls", name: "Lying Leg Curl", primary_muscle: "hamstrings", equipment: "machine", category: "machine" },
  { id: "barbell-hip-thrust", name: "Barbell Hip Thrust", primary_muscle: "glutes", equipment: "barbell", category: "barbell" },
  { id: "standing-calf-raises", name: "Standing Calf Raise", primary_muscle: "calves", equipment: "machine", category: "machine" },
  { id: "seated-calf-raise", name: "Seated Calf Raise", primary_muscle: "calves", equipment: "machine", category: "machine" },
  { id: "plank", name: "Plank", primary_muscle: "abs", equipment: "bodyweight", category: "bodyweight" },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", primary_muscle: "abs", equipment: "bodyweight", category: "bodyweight" },
].map((e) => ({
  ...e,
  secondary_muscles: [],
  instructions: "",
  form_cues: [],
  thumbnail_url: null,
  clip_url: null,
  clip_url_webm: null,
  media_source: "library",
  is_custom: false,
  owner_id: null,
  source: "rackd",
  source_id: null,
  slug: e.id,
  force: null,
  level: null,
  mechanic: null,
  movement_pattern: null,
  is_unilateral: false,
  body_part: null,
  aliases: [],
  popularity: 100,
}));

export class InMemoryStore {
  tables = new Map<string, Map<string, any>>();

  constructor() {
    this.init();
  }

  getTable(name: string): Map<string, any> {
    if (!this.tables.has(name)) {
      this.tables.set(name, new Map());
    }
    return this.tables.get(name)!;
  }

  init() {
    const exTable = this.getTable("exercises");
    for (const ex of SEED_EXERCISES) {
      exTable.set(ex.id, { ...ex });
    }

    const muscleTable = this.getTable("muscles");
    for (const m of MUSCLE_TAXONOMY) {
      muscleTable.set(m.id, {
        id: m.id,
        name: m.name,
        canonical_group: m.canonicalGroup,
        region: m.region,
        svg_region: m.svgRegion,
        recovery_hours: m.recoveryHours,
      });
    }

    const demoOwnerId = "demo-user-id";
    const now = Date.now();
    const DAY = 86_400_000;

    // User profile
    this.getTable("user_profiles").set("demo-profile-1", {
      id: "demo-profile-1",
      owner_id: demoOwnerId,
      display_name: "Demo Lifter",
      current_weight_kg: 80.5,
      goal_weight_kg: 75,
      unit_preference: "metric",
      default_rest_sec: 120,
      default_sets: 3,
      default_reps: 10,
    });

    // 3 Routines
    const routinesData = [
      {
        id: "routine-push",
        name: "Push Day",
        order: 0,
        category: "Push",
        exercises: [
          { id: "barbell-bench-press-medium-grip", sets: 4, reps: 6, weight: 80, rest: 180 },
          { id: "barbell-shoulder-press", sets: 3, reps: 8, weight: 45, rest: 120 },
          { id: "incline-dumbbell-press", sets: 3, reps: 10, weight: 28, rest: 90 },
          { id: "side-lateral-raise", sets: 3, reps: 15, weight: 10, rest: 60 },
          { id: "triceps-pushdown", sets: 3, reps: 12, weight: 25, rest: 60 },
        ],
      },
      {
        id: "routine-pull",
        name: "Pull Day",
        order: 1,
        category: "Pull",
        exercises: [
          { id: "barbell-deadlift", sets: 3, reps: 5, weight: 120, rest: 180 },
          { id: "pullups", sets: 4, reps: 8, weight: 0, rest: 120 },
          { id: "bent-over-barbell-row", sets: 3, reps: 10, weight: 70, rest: 90 },
          { id: "barbell-curl", sets: 3, reps: 12, weight: 30, rest: 60 },
          { id: "face-pull", sets: 3, reps: 15, weight: 20, rest: 60 },
        ],
      },
      {
        id: "routine-legs",
        name: "Leg Day",
        order: 2,
        category: "Legs",
        exercises: [
          { id: "barbell-squat", sets: 4, reps: 6, weight: 100, rest: 180 },
          { id: "romanian-deadlift", sets: 3, reps: 8, weight: 90, rest: 120 },
          { id: "leg-press", sets: 3, reps: 12, weight: 160, rest: 90 },
          { id: "lying-leg-curls", sets: 3, reps: 12, weight: 45, rest: 60 },
          { id: "standing-calf-raises", sets: 4, reps: 15, weight: 60, rest: 45 },
        ],
      },
    ];

    const routineTable = this.getTable("routines");
    const reTable = this.getTable("routine_exercises");
    const rsetTable = this.getTable("routine_sets");

    for (const r of routinesData) {
      routineTable.set(r.id, {
        id: r.id,
        owner_id: demoOwnerId,
        name: r.name,
        order: r.order,
        category: r.category,
      });

      for (let j = 0; j < r.exercises.length; j++) {
        const ex = r.exercises[j]!;
        const rexId = `rex-${r.id}-${j}`;
        reTable.set(rexId, {
          id: rexId,
          owner_id: demoOwnerId,
          routine_id: r.id,
          exercise_id: ex.id,
          order: j + 1,
          rest_sec: ex.rest,
          bar_type: "standard",
        });

        for (let s = 1; s <= ex.sets; s++) {
          const rsId = `rset-${rexId}-${s}`;
          rsetTable.set(rsId, {
            id: rsId,
            owner_id: demoOwnerId,
            routine_exercise_id: rexId,
            order: s,
            type: "normal",
            target_reps: ex.reps,
            target_weight: ex.weight,
          });
        }
      }
    }

    // Program: Push / Pull / Legs
    const progId = "prog-ppl";
    this.getTable("programs").set(progId, {
      id: progId,
      owner_id: demoOwnerId,
      name: "Push / Pull / Legs",
      order: 0,
      block_weeks: 4,
      active: true,
      schedule_mode: "rotation",
      rotation_cursor: 0,
      activated_at: now - 6 * DAY,
    });

    const pdayTable = this.getTable("program_days");
    for (let i = 0; i < routinesData.length; i++) {
      const r = routinesData[i]!;
      const pdayId = `pday-${progId}-${i}`;
      pdayTable.set(pdayId, {
        id: pdayId,
        owner_id: demoOwnerId,
        program_id: progId,
        order: i + 1,
        name: r.name,
        routine_id: r.id,
      });
    }

    // Finished Session from yesterday
    const sessId = "sess-demo-yesterday";
    const pullRoutine = routinesData[1]!;
    this.getTable("sessions").set(sessId, {
      id: sessId,
      owner_id: demoOwnerId,
      routine_id: pullRoutine.id,
      program_id: progId,
      name: pullRoutine.name,
      started_at: now - DAY - 3600000,
      ended_at: now - DAY,
    });

    const sexTable = this.getTable("session_exercises");
    const setLogsTable = this.getTable("set_logs");

    for (let j = 0; j < pullRoutine.exercises.length; j++) {
      const ex = pullRoutine.exercises[j]!;
      const sexId = `sex-${sessId}-${j}`;
      sexTable.set(sexId, {
        id: sexId,
        owner_id: demoOwnerId,
        session_id: sessId,
        exercise_id: ex.id,
        order: j + 1,
        rest_sec: ex.rest,
        bar_type: "standard",
      });

      for (let s = 1; s <= ex.sets; s++) {
        const slogId = `slog-${sexId}-${s}`;
        setLogsTable.set(slogId, {
          id: slogId,
          owner_id: demoOwnerId,
          session_exercise_id: sexId,
          order: s,
          type: "normal",
          weight: ex.weight,
          reps: ex.reps,
          completed: true,
          is_pr: s === 1 && ex.id === "barbell-deadlift",
        });
      }
    }

    // PRs
    this.getTable("personal_records").set("pr-deadlift", {
      id: "pr-deadlift",
      owner_id: demoOwnerId,
      exercise_id: "barbell-deadlift",
      type: "1rm",
      value: 140,
      session_id: sessId,
      achieved_at: now - DAY,
    });
    this.getTable("personal_records").set("pr-bench", {
      id: "pr-bench",
      owner_id: demoOwnerId,
      exercise_id: "barbell-bench-press-medium-grip",
      type: "1rm",
      value: 95,
      session_id: sessId,
      achieved_at: now - DAY,
    });

    // Body weight logs
    const bwTable = this.getTable("body_weight_logs");
    const bwData = [
      { daysAgo: 28, weight: 82.5 },
      { daysAgo: 21, weight: 82.0 },
      { daysAgo: 14, weight: 81.2 },
      { daysAgo: 7, weight: 80.9 },
      { daysAgo: 1, weight: 80.5 },
    ];
    for (const bw of bwData) {
      bwTable.set(`bw-${bw.daysAgo}`, {
        id: `bw-${bw.daysAgo}`,
        owner_id: demoOwnerId,
        weight_kg: bw.weight,
        logged_at: now - bw.daysAgo * DAY,
      });
    }
  }

  query(queryConfig: any, valuesArg?: any[]) {
    const text: string = typeof queryConfig === "string" ? queryConfig : queryConfig.text;
    const isArray: boolean = typeof queryConfig === "object" && queryConfig.rowMode === "array";
    const params: any[] =
      typeof queryConfig === "object" && queryConfig.values
        ? queryConfig.values
        : valuesArg || [];

    const normText = text.trim();

    // 1. SELECT
    const selectMatch = normText.match(/^select\s+(.*?)\s+from\s+"([^"]+)"(.*)/is);
    if (selectMatch) {
      const colStr = selectMatch[1]!;
      const mainTable = selectMatch[2]!;
      const rest = selectMatch[3]!;

      // Column names
      const cols: string[] = [];
      const colRegex = /(?:"([^"]+)"\.)?"([^"]+)"(?:\s+as\s+"([^"]+)")?/g;
      let m: RegExpExecArray | null;
      while ((m = colRegex.exec(colStr)) !== null) {
        cols.push(m[3] || m[2]!);
      }

      let rows = Array.from(this.getTable(mainTable).values()).map((r) => ({ ...r }));

      // Handle simple joins: leftJoin or innerJoin
      const joinMatch = rest.match(/(?:left|inner)\s+join\s+"([^"]+)"\s+on\s+(.*)/i);
      if (joinMatch) {
        const joinTable = joinMatch[1]!;
        const joinMap = this.getTable(joinTable);
        // Merge matching fields
        rows = rows.map((r) => {
          // If exercise_muscles or exercise_media or exercises
          let joinedObj: any = null;
          if (joinTable === "muscles" && r.muscle_id) {
            joinedObj = joinMap.get(r.muscle_id);
          } else if (joinTable === "exercises" && r.exercise_id) {
            joinedObj = joinMap.get(r.exercise_id);
          }
          return joinedObj ? { ...joinedObj, ...r } : r;
        });
      }

      // Handle WHERE
      const whereMatch = rest.match(/where\s+(.*?)(?:\s+order\s+by|\s+limit|$)/is);
      if (whereMatch) {
        const whereClause = whereMatch[1]!;

        // Parameter replacement in condition checking
        rows = rows.filter((r) => {
          // check owner_id = $1 or owner_id is null
          if (whereClause.includes(`"owner_id" is null or`)) {
            // Find owner param
            const pIdxMatch = whereClause.match(/"owner_id"\s*=\s*\$(\d+)/);
            if (pIdxMatch) {
              const pVal = params[Number(pIdxMatch[1]) - 1];
              if (r.owner_id != null && r.owner_id !== pVal) return false;
            }
          } else {
            const ownerMatch = whereClause.match(/"owner_id"\s*=\s*\$(\d+)/);
            if (ownerMatch) {
              const pVal = params[Number(ownerMatch[1]) - 1];
              if (r.owner_id !== pVal) return false;
            }
          }

          // check id = $1
          const idMatch = whereClause.match(/(?:^|\W)"id"\s*=\s*\$(\d+)/);
          if (idMatch) {
            const pVal = params[Number(idMatch[1]) - 1];
            if (r.id !== pVal) return false;
          }

          // check routine_id = $1
          const routineMatch = whereClause.match(/"routine_id"\s*=\s*\$(\d+)/);
          if (routineMatch) {
            const pVal = params[Number(routineMatch[1]) - 1];
            if (r.routine_id !== pVal) return false;
          }

          // check program_id = $1
          const progMatch = whereClause.match(/"program_id"\s*=\s*\$(\d+)/);
          if (progMatch) {
            const pVal = params[Number(progMatch[1]) - 1];
            if (r.program_id !== pVal) return false;
          }

          // check session_id = $1
          const sessMatch = whereClause.match(/"session_id"\s*=\s*\$(\d+)/);
          if (sessMatch) {
            const pVal = params[Number(sessMatch[1]) - 1];
            if (r.session_id !== pVal) return false;
          }

          // check session_exercise_id = $1
          const seMatch = whereClause.match(/"session_exercise_id"\s*=\s*\$(\d+)/);
          if (seMatch) {
            const pVal = params[Number(seMatch[1]) - 1];
            if (r.session_exercise_id !== pVal) return false;
          }

          // check routine_exercise_id = $1
          const reMatch = whereClause.match(/"routine_exercise_id"\s*=\s*\$(\d+)/);
          if (reMatch) {
            const pVal = params[Number(reMatch[1]) - 1];
            if (r.routine_exercise_id !== pVal) return false;
          }

          // check exercise_id = $1
          const exMatch = whereClause.match(/"exercise_id"\s*=\s*\$(\d+)/);
          if (exMatch) {
            const pVal = params[Number(exMatch[1]) - 1];
            if (r.exercise_id !== pVal) return false;
          }

          // check active = true / $1
          if (whereClause.includes(`"active" = true`)) {
            if (!r.active) return false;
          } else if (whereClause.includes(`"active" = $`)) {
            const actMatch = whereClause.match(/"active"\s*=\s*\$(\d+)/);
            if (actMatch) {
              const pVal = params[Number(actMatch[1]) - 1];
              if (Boolean(r.active) !== Boolean(pVal)) return false;
            }
          }

          // check ended_at is null
          if (whereClause.includes(`"ended_at" is null`)) {
            if (r.ended_at != null) return false;
          }

          // check completed = true
          if (whereClause.includes(`"completed" = true`)) {
            if (!r.completed) return false;
          }

          return true;
        });
      }

      // Handle ORDER BY
      const orderMatch = rest.match(/order\s+by\s+(.*?)(?:\s+limit|$)/is);
      if (orderMatch) {
        const orderPart = orderMatch[1]!;
        const desc = orderPart.toLowerCase().includes("desc");
        const colMatch = orderPart.match(/"([^"]+)"/);
        if (colMatch) {
          const col = colMatch[1]!;
          rows.sort((a, b) => {
            const va = a[col] ?? 0;
            const vb = b[col] ?? 0;
            return desc ? (vb > va ? 1 : vb < va ? -1 : 0) : (va > vb ? 1 : va < vb ? -1 : 0);
          });
        }
      }

      // Handle LIMIT
      const limitMatch = rest.match(/limit\s+(\d+|\$\d+)/i);
      if (limitMatch) {
        let lim = 1;
        if (limitMatch[1]!.startsWith("$")) {
          const pIdx = Number(limitMatch[1]!.slice(1)) - 1;
          lim = Number(params[pIdx]) || 1;
        } else {
          lim = Number(limitMatch[1]) || 1;
        }
        rows = rows.slice(0, lim);
      }

      // Map rows for driver
      const resultRows = rows.map((r) => {
        if (!isArray) return r;
        return cols.map((c) => (r[c] !== undefined ? r[c] : null));
      });

      return { rows: resultRows, rowCount: resultRows.length, fields: [] };
    }

    // 2. INSERT
    const insertMatch = normText.match(
      /^insert\s+into\s+"([^"]+)"\s*\((.*?)\)\s*values\s*\((.*?)\)(.*)/is,
    );
    if (insertMatch) {
      const table = insertMatch[1]!;
      const colsPart = insertMatch[2]!;
      const cols = colsPart.split(",").map((s) => s.trim().replace(/"/g, ""));
      const rest = insertMatch[4] || "";

      const row: any = {};
      cols.forEach((col, i) => {
        row[col] = params[i] !== undefined ? params[i] : null;
      });

      if (!row.id) {
        row.id = "gen-" + Math.random().toString(36).substring(2, 10);
      }

      this.getTable(table).set(row.id, row);

      const hasReturning = rest.toLowerCase().includes("returning");
      const retRows = hasReturning
        ? isArray
          ? [cols.map((c) => (row[c] !== undefined ? row[c] : null))]
          : [row]
        : [];

      return { rows: retRows, rowCount: 1, fields: [] };
    }

    // 3. UPDATE
    const updateMatch = normText.match(/^update\s+"([^"]+)"\s+set\s+(.*?)\s+where\s+(.*)/is);
    if (updateMatch) {
      const table = updateMatch[1]!;
      const setPart = updateMatch[2]!;
      const wherePart = updateMatch[3]!;

      // Parse SET assignments
      // "col1" = $1, "col2" = $2
      const updates: Record<string, any> = {};
      const assignRegex = /"([^"]+)"\s*=\s*(?:(\$\d+)|null|true|false|(\d+))/gi;
      let am: RegExpExecArray | null;
      while ((am = assignRegex.exec(setPart)) !== null) {
        const col = am[1]!;
        if (am[2]) {
          const pIdx = Number(am[2].slice(1)) - 1;
          updates[col] = params[pIdx];
        } else if (am[0].toLowerCase().includes("null")) {
          updates[col] = null;
        } else if (am[0].toLowerCase().includes("true")) {
          updates[col] = true;
        } else if (am[0].toLowerCase().includes("false")) {
          updates[col] = false;
        }
      }

      // Find targets
      const tMap = this.getTable(table);
      const rows = Array.from(tMap.values());
      const updatedList: any[] = [];

      // Check id = $N
      const idMatch = wherePart.match(/"id"\s*=\s*\$(\d+)/);
      const targetId = idMatch ? params[Number(idMatch[1]) - 1] : null;

      for (const r of rows) {
        if (!targetId || r.id === targetId) {
          Object.assign(r, updates);
          updatedList.push(r);
        }
      }

      const hasReturning = wherePart.toLowerCase().includes("returning");
      const retRows = hasReturning
        ? isArray
          ? updatedList.map((r) => Object.values(r))
          : updatedList
        : [];

      return { rows: retRows, rowCount: updatedList.length, fields: [] };
    }

    // 4. DELETE
    const deleteMatch = normText.match(/^delete\s+from\s+"([^"]+)"\s+where\s+(.*)/is);
    if (deleteMatch) {
      const table = deleteMatch[1]!;
      const wherePart = deleteMatch[2]!;
      const tMap = this.getTable(table);

      const idMatch = wherePart.match(/"id"\s*=\s*\$(\d+)/);
      const routineMatch = wherePart.match(/"routine_id"\s*=\s*\$(\d+)/);

      if (idMatch) {
        const targetId = params[Number(idMatch[1]) - 1];
        tMap.delete(targetId);
      } else if (routineMatch) {
        const rId = params[Number(routineMatch[1]) - 1];
        for (const [id, row] of Array.from(tMap.entries())) {
          if (row.routine_id === rId) {
            tMap.delete(id);
          }
        }
      }

      return { rows: [], rowCount: 1, fields: [] };
    }

    return { rows: [], rowCount: 0, fields: [] };
  }
}

export function createInMemoryPool() {
  const store = new InMemoryStore();
  const pool = {
    query: async (queryConfig: any, values?: any[]) => {
      return store.query(queryConfig, values);
    },
    connect: async () => ({
      query: async (queryConfig: any, values?: any[]) => store.query(queryConfig, values),
      release: () => {},
    }),
    on: () => {},
    end: async () => {},
  };
  return pool;
}
