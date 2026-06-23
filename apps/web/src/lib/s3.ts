import { createHash, createHmac } from "node:crypto";

/**
 * Minimal S3 (MinIO) PutObject via AWS SigV4 — server-only, zero extra deps.
 * We sign with Node crypto and PUT the bytes with path-style addressing
 * (`{endpoint}/{bucket}/{key}`), which MinIO uses. Binaries live in the object
 * store; only the resulting public URL is ever persisted (media rule).
 */

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Allowed image MIME types → file extension used for the object key. */
export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

interface S3Config {
  endpoint: string; // server-side, e.g. http://minio:9000
  publicUrl: string; // browser-facing base incl. bucket, e.g. http://host:9000/myfit
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

/** Read + validate S3 env at call time (server runtime, not build). */
export function getS3Config(): S3Config {
  const endpoint = process.env.S3_ENDPOINT;
  const publicUrl = process.env.S3_PUBLIC_URL;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !publicUrl || !bucket || !accessKey || !secretKey) {
    throw new Error("S3 storage is not configured");
  }
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    publicUrl: publicUrl.replace(/\/+$/, ""),
    bucket,
    region: process.env.S3_REGION || "us-east-1",
    accessKey,
    secretKey,
  };
}

const hex = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data, "utf8").digest();

/** Upload bytes and return the public URL. `key` is the object path in the bucket. */
export async function putObject(
  cfg: S3Config,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const url = new URL(`${cfg.endpoint}/${cfg.bucket}/${key}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hex(body);

  // Canonical request. SignedHeaders must be sorted by lowercase name.
  const headers: Record<string, string> = {
    host: url.host,
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders =
    Object.keys(headers)
      .sort()
      .map((h) => `${h}:${headers[h]}\n`)
      .join("") ;
  const canonicalRequest = [
    "PUT",
    url.pathname,
    "", // no query
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${cfg.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, Authorization: authorization },
    // Buffer is a valid body; DOM's BodyInit generic doesn't model node Buffer.
    body: body as unknown as BodyInit,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`S3 upload failed (${res.status}) ${detail.slice(0, 200)}`);
  }
  return `${cfg.publicUrl}/${key}`;
}
