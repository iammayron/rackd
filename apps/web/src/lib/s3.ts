/**
 * Photo-upload constants for the profile-photo route. The generic S3 SigV4
 * client (getS3Config/putObject) lives in @rackd/db (shared with the exercise
 * media mirror) — re-exported here so existing imports from "@/lib/s3" keep
 * working.
 */
export { getS3Config, putObject } from "@rackd/db/s3";
export type { S3Config } from "@rackd/db/s3";

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Allowed image MIME types → file extension used for the object key. */
export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
