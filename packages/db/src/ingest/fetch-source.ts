import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CACHE_DIR, sourceFile } from "./paths";

/**
 * Download a source dataset to the local ingest cache (gitignored). Keeps the
 * network fetch separate from the DB seed so seeding is offline + repeatable.
 *
 *   pnpm --filter @rackd/db ingest:fetch
 */

const SOURCES: Record<string, string> = {
  "free-exercise-db":
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json",
};

export async function fetchSource(source: string): Promise<string> {
  const url = SOURCES[source];
  if (!url)
    throw new Error(`Unknown source "${source}". Known: ${Object.keys(SOURCES).join(", ")}`);
  const out = sourceFile(source);
  console.log(`[fetch] ${source} ← ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`);
  const body = await res.text();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, body, "utf8");
  const count = Array.isArray(JSON.parse(body)) ? JSON.parse(body).length : "?";
  console.log(`[fetch] wrote ${out} (${count} records, ${body.length} bytes)`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const source =
    process.argv.find((a) => a.startsWith("--source="))?.split("=")[1] ?? "free-exercise-db";
  void CACHE_DIR;
  fetchSource(source)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[fetch] failed", e);
      process.exit(1);
    });
}
