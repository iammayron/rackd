/** Android shell bridge for the installed app version (Settings footer). */
export interface NativeAppCap {
  isNativePlatform?: () => boolean;
  nativePromise?: (
    plugin: string,
    method: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function appCap(): NativeAppCap | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { Capacitor?: NativeAppCap }).Capacitor ?? null;
}

/** Native versionName when running inside the Android shell; null in a browser. */
export async function readNativeVersion(cap: NativeAppCap | null | undefined): Promise<string | null> {
  if (!cap?.isNativePlatform?.() || typeof cap.nativePromise !== "function") return null;
  const info = await cap.nativePromise("RackdApp", "getInfo", {});
  if (!info || typeof info !== "object") return null;
  const name = (info as { versionName?: unknown }).versionName;
  return typeof name === "string" && name.trim() !== "" ? name.trim() : null;
}
