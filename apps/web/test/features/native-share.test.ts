import { describe, expect, it, vi } from "vitest";
import { deliverShareImage, type NativeShareCap } from "@/features/share/native-share";

describe("deliverShareImage", () => {
  it("does nothing in a browser", async () => {
    await expect(
      deliverShareImage(null, "save", "data:image/png;base64,aaa", "caption"),
    ).resolves.toBe(false);
    await expect(
      deliverShareImage({ isNativePlatform: () => false, nativePromise: vi.fn() }, "share", "aaa", ""),
    ).resolves.toBe(false);
  });

  it("sends the png bytes to the Android shell", async () => {
    const nativePromise = vi.fn(async () => ({}));
    const cap: NativeShareCap = { isNativePlatform: () => true, nativePromise };
    await expect(
      deliverShareImage(cap, "save", "data:image/png;base64,abc+def", "Pull Day"),
    ).resolves.toBe(true);
    expect(nativePromise).toHaveBeenCalledWith("RackdShare", "save", {
      base64: "abc+def",
      text: "Pull Day",
    });
  });
});
