import { beforeEach, describe, it, expect } from "vitest";
import { createRoutine } from "@rackd/db";
import { GET, PUT, DELETE } from "@/app/api/routines/[id]/route";
import { resetDb, authedRequest, ctx } from "../db-helper";

const A = "owner-a";
const B = "owner-b";

describe("/api/routines/[id] owner isolation", () => {
  beforeEach(() => resetDb());

  it("401 without a token", async () => {
    const res = await GET(authedRequest("http://t/api/routines/x", null), ctx({ id: "x" }));
    expect(res.status).toBe(401);
  });

  it("owner reads their own routine", async () => {
    const r = await createRoutine({ ownerId: A, name: "Mine" });
    const res = await GET(authedRequest(`http://t/api/routines/${r.id}`, A), ctx({ id: r.id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Mine");
    expect(Array.isArray(body.exercises)).toBe(true);
  });

  it("a different owner cannot read it (404, no existence leak)", async () => {
    const r = await createRoutine({ ownerId: A, name: "Mine" });
    const res = await GET(authedRequest(`http://t/api/routines/${r.id}`, B), ctx({ id: r.id }));
    expect(res.status).toBe(404);
  });

  it("a different owner cannot rename it, and the row is unchanged", async () => {
    const r = await createRoutine({ ownerId: A, name: "Mine" });
    const res = await PUT(
      authedRequest(`http://t/api/routines/${r.id}`, B, {
        method: "PUT",
        body: JSON.stringify({ name: "Hacked" }),
      }),
      ctx({ id: r.id }),
    );
    expect([403, 404]).toContain(res.status);
    const owned = await GET(authedRequest(`http://t/api/routines/${r.id}`, A), ctx({ id: r.id }));
    expect((await owned.json()).name).toBe("Mine");
  });

  it("a different owner cannot delete it", async () => {
    const r = await createRoutine({ ownerId: A, name: "Mine" });
    const res = await DELETE(
      authedRequest(`http://t/api/routines/${r.id}`, B, { method: "DELETE" }),
      ctx({ id: r.id }),
    );
    expect([403, 404]).toContain(res.status);
    const still = await GET(authedRequest(`http://t/api/routines/${r.id}`, A), ctx({ id: r.id }));
    expect(still.status).toBe(200);
  });
});
