import { get, set, del, keys } from "idb-keyval";
import { getSupabase } from "./supabase";

/**
 * IndexedDB-backed FIFO queue of write mutations made while offline. The service
 * worker can't replay arbitrary authed POSTs, so we persist them here and flush
 * on reconnect / app mount. Reads are covered separately by the React Query
 * cache persisted to IndexedDB.
 */
interface QueuedMutation {
  id: string;
  url: string;
  method: string;
  body?: string;
  createdAt: number;
}

const PREFIX = "mutation:";

export function isWriteMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

export async function enqueue(mutation: Omit<QueuedMutation, "id" | "createdAt">): Promise<void> {
  const entry: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await set(`${PREFIX}${entry.id}`, entry);
}

/** Replay queued mutations oldest-first; stop on the first failure (still offline). */
export async function flushQueue(): Promise<number> {
  const allKeys = await keys();
  const mutationKeys = allKeys.filter((k) => String(k).startsWith(PREFIX));
  const entries: QueuedMutation[] = [];
  for (const key of mutationKeys) {
    const entry = await get<QueuedMutation>(key);
    if (entry) entries.push(entry);
  }
  entries.sort((a, b) => a.createdAt - b.createdAt);

  let flushed = 0;
  for (const entry of entries) {
    const { data } = await getSupabase().auth.getSession();
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: {
          "Content-Type": "application/json",
          ...(data.session?.access_token
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {}),
        },
        body: entry.body,
      });
      if (res.ok) {
        await del(`${PREFIX}${entry.id}`);
        flushed++;
      } else {
        break; // server-side rejection — stop, leave the rest queued
      }
    } catch {
      break; // still offline
    }
  }
  return flushed;
}
