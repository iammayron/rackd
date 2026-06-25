// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pure client-lib tests for the typed fetch wrapper (`api`) and the
 * offline-aware mutation helper (`apiMutate`). No DB: idb-keyval is an in-memory
 * Map and fetch is a vi.fn(). The global Supabase mock (test/setup.ts) supplies a
 * fixed access token; the "no session" case re-mocks ./supabase per-test.
 */

const store = new Map<unknown, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: unknown) => store.get(key)),
  set: vi.fn(async (key: unknown, value: unknown) => {
    store.set(key, value);
  }),
  del: vi.fn(async (key: unknown) => {
    store.delete(key);
  }),
  keys: vi.fn(async () => Array.from(store.keys())),
}));

import { api, apiMutate } from "../../src/lib/api";

const PREFIX = "mutation:";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

function jsonRes(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

function textRes(text: string, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  };
}

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
  vi.resetModules();
  global.fetch = vi.fn();
  setOnline(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api", () => {
  it("GET ok returns the parsed body and attaches auth + content-type headers", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonRes({ hello: "world" }));

    const result = await api<{ hello: string }>("/api/thing");
    expect(result).toEqual({ hello: "world" });

    const [path, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(path).toBe("/api/thing");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe("Bearer test-session-token");
  });

  it("returns undefined on a 204 / empty body (does not throw on JSON.parse)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonRes(undefined, 204));

    await expect(api("/api/thing", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("throws an Error containing the status and body text on non-2xx", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(textRes("kaboom", 500));

    await expect(api("/api/thing")).rejects.toThrow(/500/);
    await expect(api("/api/thing")).rejects.toThrow(/kaboom/);
  });

  it("omits the Authorization header when there is no session", async () => {
    // Re-mock ./supabase so getSession resolves no session, with a fresh module graph.
    vi.doMock("../../src/lib/supabase", () => ({
      getSupabase: () => ({
        auth: {
          getSession: async () => ({ data: { session: null }, error: null }),
        },
      }),
    }));
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ ok: true }));
    global.fetch = fetchMock;

    const { api: freshApi } = await import("../../src/lib/api");
    await freshApi("/api/thing");

    const init = fetchMock.mock.calls[0]![1];
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers["Content-Type"]).toBe("application/json");
  });
});

describe("apiMutate", () => {
  it("online success returns the parsed result and queues nothing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonRes({ id: 7 }));

    const result = await apiMutate<{ id: number }>("/api/thing", {
      method: "POST",
      body: '{"a":1}',
    });
    expect(result).toEqual({ id: 7 });
    expect(store.size).toBe(0);
  });

  it("offline write failure enqueues the mutation and resolves undefined", async () => {
    setOnline(false);
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("offline"));

    const result = await apiMutate("/api/thing", { method: "POST", body: '{"a":1}' });
    expect(result).toBeUndefined();

    const keys = Array.from(store.keys()) as string[];
    expect(keys).toHaveLength(1);
    expect(keys[0]!.startsWith(PREFIX)).toBe(true);
    const entry = store.get(keys[0]!) as Record<string, unknown>;
    expect(entry.url).toBe("/api/thing");
    expect(entry.method).toBe("POST");
    expect(entry.body).toBe('{"a":1}');
  });

  it("offline READ (non-write) failure rethrows and does not enqueue", async () => {
    setOnline(false);
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("offline"));

    await expect(apiMutate("/api/thing", { method: "GET" })).rejects.toThrow(/offline/);
    expect(store.size).toBe(0);
  });
});
