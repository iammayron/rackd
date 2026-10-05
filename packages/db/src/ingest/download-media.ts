import { eq, like } from "drizzle-orm";
import { db } from "../db";
import { exerciseMedia, exercises } from "../schema";
import { getS3Config, putObject } from "../s3";

/**
 * Mirror source exercise images to our own object store (Tigris on Fly, MinIO in
 * dev) and rewrite exercise_media.url to the mirrored URL. Decouples us from the
 * source CDN + enables offline caching. Idempotent + resumable: only rows still
 * pointing at the source host are processed, so re-runs skip mirrored media.
 *
 *   pnpm --filter @rackd/db ingest:media [-- --limit=100 --dry-run]
 */

const SOURCE_HOST = "raw.githubusercontent.com";
const CONCURRENCY = 6;

const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function extOf(url: string): string {
  const m = url.split("?")[0]?.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] ?? "jpg").toLowerCase();
}

/** Run `worker` over `items` with bounded concurrency. */
async function pool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]!);
    }
  });
  await Promise.all(runners);
}

export async function downloadMedia(
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<void> {
  const cfg = getS3Config(); // throws early if storage isn't configured

  let rows = await db
    .select({
      id: exerciseMedia.id,
      exerciseId: exerciseMedia.exerciseId,
      url: exerciseMedia.url,
      originalUrl: exerciseMedia.originalUrl,
      order: exerciseMedia.order,
    })
    .from(exerciseMedia)
    .where(like(exerciseMedia.url, `%${SOURCE_HOST}%`));
  if (opts.limit) rows = rows.slice(0, opts.limit);

  console.log(`[media] ${rows.length} image(s) to mirror`);
  if (opts.dryRun) {
    console.log("[media] dry run — sample:", rows.slice(0, 3));
    return;
  }

  let done = 0;
  let failed = 0;
  await pool(rows, CONCURRENCY, async (row) => {
    const src = row.originalUrl ?? row.url;
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`GET ${src} → HTTP ${res.status}`);
      const ext = extOf(src);
      const body = Buffer.from(await res.arrayBuffer());
      const key = `exercises/${row.exerciseId}/${row.order}.${ext}`;
      const publicUrl = await putObject(cfg, key, body, CONTENT_TYPE[ext] ?? "image/jpeg");

      await db.update(exerciseMedia).set({ url: publicUrl }).where(eq(exerciseMedia.id, row.id));
      // Repoint the exercise thumbnail if it still references the source URL.
      await db
        .update(exercises)
        .set({ thumbnailUrl: publicUrl })
        .where(eq(exercises.thumbnailUrl, row.url));

      done++;
      if (done % 100 === 0) console.log(`[media] ${done}/${rows.length} mirrored`);
    } catch (e) {
      failed++;
      console.warn(`[media] failed ${row.id}: ${(e as Error).message}`);
    }
  });

  console.log(`[media] done — ${done} mirrored, ${failed} failed`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const limit =
    Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || undefined;
  const dryRun = process.argv.includes("--dry-run");
  downloadMedia({ limit, dryRun })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[media] failed", e);
      process.exit(1);
    });
}
