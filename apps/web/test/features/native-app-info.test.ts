import { describe, expect, it, vi } from "vitest";
import { readNativeVersion, type NativeAppCap } from "@/features/settings/native-app-info";

describe("readNativeVersion", () => {
  it("returns null in a browser", async () => {
    await expect(readNativeVersion(null)).resolves.toBeNull();
    await expect(
      readNativeVersion({ isNativePlatform: () => false, nativePromise: vi.fn() }),
    ).resolves.toBeNull();
  });

  it("reads versionName from the Android shell", async () => {
    const nativePromise = vi.fn(async () => ({ versionName: "1.5", versionCode: 5 }));
    const cap: NativeAppCap = { isNativePlatform: () => true, nativePromise };
    await expect(readNativeVersion(cap)).resolves.toBe("1.5");
    expect(nativePromise).toHaveBeenCalledWith("RackdApp", "getInfo", {});
  });

  it("returns null when the shell omits versionName", async () => {
    const nativePromise = vi.fn(async () => ({}));
    await expect(
      readNativeVersion({ isNativePlatform: () => true, nativePromise }),
    ).resolves.toBeNull();
  });
});
