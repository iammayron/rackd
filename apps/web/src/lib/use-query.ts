"use client";

import { useEffect, useState } from "react";
import { getClient } from "./triplit";
import type { Client } from "@myfit/db";

type QueryBuilder = ReturnType<Client["query"]>;

/**
 * Minimal reactive Triplit query hook (avoids pulling in @triplit/react).
 * Pass a factory so the query rebuilds when `deps` change.
 */
export function useQuery<T = Record<string, unknown>>(
  build: (client: Client) => QueryBuilder,
  deps: unknown[] = [],
): { results: T[]; fetching: boolean } {
  const [results, setResults] = useState<T[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const client = getClient();
    setFetching(true);
    const unsubscribe = client.subscribe(
      build(client),
      (rows) => {
        setResults(rows as T[]);
        setFetching(false);
      },
      (err) => {
        console.error("[triplit] query error", err);
        setFetching(false);
      },
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { results, fetching };
}
