import { getSupabase } from "./supabase";
import { enqueue, isWriteMethod } from "./offline-queue";

/**
 * Typed fetch wrapper for the JSON API. Attaches the Supabase access token and
 * throws on non-2xx so React Query surfaces the error.
 */
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(data.session?.access_token
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  // 204 / empty body → undefined.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Like `api`, but on a network failure for a write it queues the mutation in
 * IndexedDB (offline support) and resolves optimistically with `undefined`.
 * Reads always go straight through (served from the React Query cache when
 * offline). Use for fire-and-forget mutations that tolerate eventual delivery.
 */
export async function apiMutate<T = unknown>(
  path: string,
  options: RequestInit & { method: string },
): Promise<T | undefined> {
  try {
    return await api<T>(path, options);
  } catch (e) {
    if (isWriteMethod(options.method) && !navigator.onLine) {
      await enqueue({
        url: path,
        method: options.method,
        body: typeof options.body === "string" ? options.body : undefined,
      });
      return undefined;
    }
    throw e;
  }
}
