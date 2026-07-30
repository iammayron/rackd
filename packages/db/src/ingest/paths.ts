import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/** Local ingest cache dir (gitignored): packages/db/.cache/ingest/. */
const here = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = resolve(here, "../../.cache/ingest");

/** Where each source's raw dataset is cached after `ingest:fetch`. */
export const SOURCE_FILES: Record<string, string> = {
  "free-exercise-db": resolve(CACHE_DIR, "free-exercise-db.json"),
};

/** Cache path for a source, or throw if the source is unknown. */
export function sourceFile(source: string): string {
  const f = SOURCE_FILES[source];
  if (!f)
    throw new Error(`Unknown source "${source}". Known: ${Object.keys(SOURCE_FILES).join(", ")}`);
  return f;
}
