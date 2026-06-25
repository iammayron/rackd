import { beforeEach, describe, it, expect } from "vitest";
import { createRoutine, startSession } from "@rackd/db";
import { POST as saveBackPOST } from "@/app/api/sessions/[id]/save-back/route";
import { resetDb, authedRequest, ctx } from "../db-helper";

const A = "owner-a";

describe("API route validation", () => {
  beforeEach(() => resetDb());

  it("POST /api/sessions/[id]/save-back rejects an invalid mode with 400", async () => {
    const session = await startSession({ ownerId: A, name: "Workout", now: Date.now() });
    const r = await createRoutine({ ownerId: A, name: "Target" });
    const res = await saveBackPOST(
      authedRequest(`http://t/api/sessions/${session.id}/save-back`, A, {
        method: "POST",
        body: JSON.stringify({ mode: "bogus", routineId: r.id }),
      }),
      ctx({ id: session.id }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid mode");
  });

  it("POST /api/sessions/[id]/save-back rejects a missing mode with 400 (before touching the routine)", async () => {
    const session = await startSession({ ownerId: A, name: "Workout", now: Date.now() });
    // No `mode` and a non-existent routineId: mode is validated first, so 400 (not 404).
    const res = await saveBackPOST(
      authedRequest(`http://t/api/sessions/${session.id}/save-back`, A, {
        method: "POST",
        body: JSON.stringify({ routineId: "does-not-exist" }),
      }),
      ctx({ id: session.id }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid mode");
  });

  it("POST /api/sessions/[id]/save-back returns 404 for a session that does not exist", async () => {
    const res = await saveBackPOST(
      authedRequest("http://t/api/sessions/missing/save-back", A, {
        method: "POST",
        body: JSON.stringify({ mode: "numbers", routineId: "whatever" }),
      }),
      ctx({ id: "missing" }),
    );
    expect(res.status).toBe(404);
  });

  it("POST /api/sessions/[id]/save-back with a valid mode but unknown target routine returns 404", async () => {
    const session = await startSession({ ownerId: A, name: "Workout", now: Date.now() });
    // Valid mode passes the 400 gate; the target routine lookup then 404s.
    const res = await saveBackPOST(
      authedRequest(`http://t/api/sessions/${session.id}/save-back`, A, {
        method: "POST",
        body: JSON.stringify({ mode: "numbers", routineId: "does-not-exist" }),
      }),
      ctx({ id: session.id }),
    );
    expect(res.status).toBe(404);
  });
});
