// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pure client-lib tests for the IndexedDB-backed offline mutation queue. No DB:
 * idb-keyval is replaced with an in-memory Map and fetch is a vi.fn(). The global
 * Supabase mock (test/setup.ts) makes getSession() resolve a fixed access token.
 */

// In-memory idb-keyval backed by a Map, reset between tests.
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

import { enqueue, flushQueue, isWriteMethod } from "../../src/lib/offline-queue";

const PREFIX = "mutation:";

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Insert a queued mutation directly into the store with a controlled createdAt. */
function seed(entry: {
  id: string;
  url: string;
  method: string;
  body?: string;
  createdAt: number;
}) {
  store.set(`${PREFIX}${entry.id}`, entry);
}

function okRes() {
  return { ok: true, status: 200 };
}
function notOkRes() {
  return { ok: false, status: 409 };
}

describe("isWriteMethod", () => {
  it("returns true for write methods (case-insensitive)", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE", "post", "put", "patch", "delete"]) {
      expect(isWriteMethod(m)).toBe(true);
    }
  });

  it("returns false for read/other methods", () => {
    for (const m of ["GET", "HEAD", "get", "head", "OPTIONS"]) {
      expect(isWriteMethod(m)).toBe(false);
    }
  });
});

describe("enqueue", () => {
  it("stores an entry under a mutation: key with id + createdAt", async () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    await enqueue({ url: "/api/x", method: "POST", body: '{"a":1}' });

    const keys = Array.from(store.keys()) as string[];
    expect(keys).toHaveLength(1);
    expect(keys[0]!.startsWith(PREFIX)).toBe(true);

    const entry = store.get(keys[0]!) as Record<string, unknown>;
    expect(entry.url).toBe("/api/x");
    expect(entry.method).toBe("POST");
    expect(entry.body).toBe('{"a":1}');
    expect(typeof entry.id).toBe("string");
    expect((entry.id as string).length).toBeGreaterThan(0);
    expect(entry.createdAt).toBe(123456);
    // key is keyed by the generated id.
    expect(keys[0]).toBe(`${PREFIX}${entry.id}`);
  });
});

describe("flushQueue", () => {
  it("returns 0 and does not fetch on an empty queue", async () => {
    const flushed = await flushQueue();
    expect(flushed).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("replays oldest-first (FIFO by createdAt), deletes all, returns count", async () => {
    // Seed out of insertion order to prove the sort.
    seed({ id: "b", url: "/api/2", method: "POST", body: "2", createdAt: 200 });
    seed({ id: "c", url: "/api/3", method: "POST", body: "3", createdAt: 300 });
    seed({ id: "a", url: "/api/1", method: "POST", body: "1", createdAt: 100 });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okRes());

    const flushed = await flushQueue();
    expect(flushed).toBe(3);

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Assert FIFO order of replay.
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/1");
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/2");
    expect(fetchMock.mock.calls[2]![0]).toBe("/api/3");

    // Everything removed from idb.
    expect(store.size).toBe(0);
  });

  it("carries the Authorization bearer + stored body/method on each replay", async () => {
    seed({ id: "a", url: "/api/1", method: "PATCH", body: '{"v":1}', createdAt: 100 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okRes());

    await flushQueue();

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"v":1}');
    expect(init.headers["Content-Type"]).toBe("application/json");
    // Token from the global supabase mock.
    expect(init.headers.Authorization).toBe("Bearer test-session-token");
  });

  it("stops on a non-ok response: deletes only the successful ones, leaves the rest", async () => {
    seed({ id: "a", url: "/api/1", method: "POST", body: "1", createdAt: 100 });
    seed({ id: "b", url: "/api/2", method: "POST", body: "2", createdAt: 200 });
    seed({ id: "c", url: "/api/3", method: "POST", body: "3", createdAt: 300 });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(okRes())
      .mockResolvedValueOnce(okRes())
      .mockResolvedValueOnce(notOkRes());

    const flushed = await flushQueue();
    expect(flushed).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // First two deleted, the third remains queued.
    expect(store.has(`${PREFIX}a`)).toBe(false);
    expect(store.has(`${PREFIX}b`)).toBe(false);
    expect(store.has(`${PREFIX}c`)).toBe(true);
  });

  it("stops on a network error mid-flush, leaving the remainder queued", async () => {
    seed({ id: "a", url: "/api/1", method: "POST", body: "1", createdAt: 100 });
    seed({ id: "b", url: "/api/2", method: "POST", body: "2", createdAt: 200 });
    seed({ id: "c", url: "/api/3", method: "POST", body: "3", createdAt: 300 });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(okRes()).mockRejectedValueOnce(new Error("offline"));

    const flushed = await flushQueue();
    expect(flushed).toBe(1);
    // Stopped at the throw — third request never attempted.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(store.has(`${PREFIX}a`)).toBe(false);
    expect(store.has(`${PREFIX}b`)).toBe(true);
    expect(store.has(`${PREFIX}c`)).toBe(true);
  });
});
