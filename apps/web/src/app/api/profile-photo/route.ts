import { uuidv7 } from "uuidv7";
import { getS3Config, putObject, PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/s3";

// Node runtime: the S3 signing uses node:crypto and runs server-side only.
export const runtime = "nodejs";

/**
 * POST a single image (multipart field `file`); stores it in MinIO and returns
 * `{ url }`. The browser saves that URL to the profile — no binary ever touches
 * the synced DB. Validation mirrors the client constraints so a crafted request
 * can't bypass them.
 */
export async function POST(req: Request): Promise<Response> {
  let cfg;
  try {
    cfg = getS3Config();
  } catch {
    return Response.json({ error: "Photo storage is not configured." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  const ext = PHOTO_TYPES[file.type];
  if (!ext) {
    return Response.json({ error: "Unsupported image type." }, { status: 415 });
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return Response.json({ error: "Image is too large." }, { status: 413 });
  }

  const body = Buffer.from(await file.arrayBuffer());
  const key = `profile-photos/${uuidv7()}.${ext}`;
  try {
    const url = await putObject(cfg, key, body, file.type);
    return Response.json({ url });
  } catch (e) {
    console.error("[myfit] photo upload failed", e);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
