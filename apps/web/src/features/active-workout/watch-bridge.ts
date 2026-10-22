/** Capacitor's Android shell. `registerPlugin` is added by `@capacitor/core`, which this app does not bundle. The shell itself exposes `nativePromise`. */
export interface WatchCap {
  isNativePlatform?: () => boolean;
  nativePromise?: (
    plugin: string,
    method: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  nativeCallback?: (
    plugin: string,
    method: string,
    options: Record<string, unknown>,
    cb: (data: unknown, err?: unknown) => void,
  ) => string;
  registerPlugin?: (name: string) => WatchPlugin;
}

export interface WatchAction {
  type: string;
  restEndAt: number;
  revision: number;
}

export interface WatchSnapshot {
  revision: number;
  restEndAt: number;
  sessionId: string;
}

export interface WatchPlugin {
  publish(opts: { payload: string; token: string; apiBase: string }): Promise<void>;
  clear(): Promise<void>;
  sync(): Promise<WatchSnapshot>;
  addListener(
    event: "action",
    cb: (event: WatchAction) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const PLUGIN = "RackdWear";

export function canMirrorToWatch(cap: WatchCap | null | undefined): boolean {
  if (!cap?.isNativePlatform?.()) return false;
  return typeof cap.nativePromise === "function" || typeof cap.registerPlugin === "function";
}

/** Plugin proxy. Prefers the shell's `nativePromise` so a missing `registerPlugin` still reaches Java. */
export function watchPlugin(cap: WatchCap): WatchPlugin {
  if (typeof cap.nativePromise === "function") {
    const call = cap.nativePromise;
    return {
      publish: (opts) => call(PLUGIN, "publish", opts) as Promise<void>,
      clear: () => call(PLUGIN, "clear", {}) as Promise<void>,
      sync: () => call(PLUGIN, "sync", {}) as Promise<WatchSnapshot>,
      addListener: (event, cb) => {
        const id = cap.nativeCallback?.(PLUGIN, "addListener", { eventName: event }, (data) => {
          if (!data || typeof data !== "object" || !("type" in data)) return;
          cb(data as WatchAction);
        });
        return Promise.resolve({
          remove: async () => {
            await call(PLUGIN, "removeListener", { eventName: event, callbackId: id ?? "" });
          },
        });
      },
    };
  }
  return cap.registerPlugin!(PLUGIN);
}
