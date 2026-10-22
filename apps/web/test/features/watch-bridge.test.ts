import { describe, expect, it, vi } from "vitest";
import { canMirrorToWatch, watchPlugin } from "@/features/active-workout/watch-bridge";

describe("canMirrorToWatch", () => {
  it("is false in a browser and in the installed PWA", () => {
    expect(canMirrorToWatch(null)).toBe(false);
    expect(canMirrorToWatch({ isNativePlatform: () => false, nativePromise: vi.fn() })).toBe(false);
    expect(canMirrorToWatch({ isNativePlatform: () => true })).toBe(false);
  });

  it("is true when the Android shell exposes nativePromise without registerPlugin", () => {
    expect(canMirrorToWatch({ isNativePlatform: () => true, nativePromise: vi.fn() })).toBe(true);
  });
});

describe("watchPlugin", () => {
  it("calls RackdWear through nativePromise", async () => {
    const nativePromise = vi.fn(async () => ({ revision: 2, restEndAt: 0, sessionId: "s1" }));
    const plugin = watchPlugin({ isNativePlatform: () => true, nativePromise });
    await plugin.sync();
    await plugin.publish({ payload: "{}", token: "t", apiBase: "https://rackd.fly.dev" });
    expect(nativePromise).toHaveBeenNthCalledWith(1, "RackdWear", "sync", {});
    expect(nativePromise).toHaveBeenNthCalledWith(2, "RackdWear", "publish", {
      payload: "{}",
      token: "t",
      apiBase: "https://rackd.fly.dev",
    });
  });
});
