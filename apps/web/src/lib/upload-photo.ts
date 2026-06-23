"use client";

/**
 * Client-side profile photo upload. Validates type/size before sending so the
 * user gets instant feedback, then POSTs to the server route which signs the
 * MinIO upload and returns the stored URL. Kept in sync with the server checks
 * in `lib/s3.ts` (duplicated, not imported, to keep node:crypto out of the bundle).
 */

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const ALLOWED = new Set(PHOTO_ACCEPT.split(","));

/** Validate then upload; returns the public URL. Throws Error with a clear message. */
export async function uploadProfilePhoto(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size > PHOTO_MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/profile-photo", { method: "POST", body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Upload failed. Please try again.");
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}
