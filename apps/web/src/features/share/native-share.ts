/** Android shell bridge. The WebView's download link and file share do not reach the gallery. */
export interface NativeShareCap {
  isNativePlatform?: () => boolean;
  nativePromise?: (
    plugin: string,
    method: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function shareCap(): NativeShareCap | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { Capacitor?: NativeShareCap }).Capacitor ?? null;
}

/** True when the Android app accepted the image. False when this is a normal browser. */
export async function deliverShareImage(
  cap: NativeShareCap | null | undefined,
  mode: "share" | "save",
  dataUrl: string,
  text: string,
): Promise<boolean> {
  if (!cap?.isNativePlatform?.() || typeof cap.nativePromise !== "function") return false;
  const comma = dataUrl.indexOf(",");
  const base64 = dataUrl.startsWith("data:") && comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  await cap.nativePromise("RackdShare", mode, { base64, text });
  return true;
}
