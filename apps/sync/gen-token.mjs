import { createHmac, randomUUID } from "node:crypto";

/**
 * Generate HS256 tokens for the self-hosted Triplit server (no extra deps).
 *
 *   node gen-token.mjs <JWT_SECRET> service       # full-access (server-to-server)
 *   node gen-token.mjs <JWT_SECRET> anon          # anonymous (rules apply)
 *   node gen-token.mjs <JWT_SECRET> user <userId> # a specific user
 *
 * Token type drives Triplit authorization. "service" bypasses rules — fine for a
 * single-user tailnet deploy; switch to per-user tokens + schema roles for multi-user.
 */
const [, , secret, kind = "service", userId] = process.argv;
if (!secret) {
  console.error("usage: node gen-token.mjs <JWT_SECRET> [service|anon|user] [userId]");
  process.exit(1);
}

const b64 = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

const header = { alg: "HS256", typ: "JWT" };
const payload = {
  "x-triplit-token-type": kind === "service" ? "secret" : kind === "anon" ? "anon" : "external",
  iat: 1700000000,
};
if (kind === "user") {
  payload["x-triplit-user-id"] = userId ?? `user_${randomUUID()}`;
  payload.sub = payload["x-triplit-user-id"];
}

const data = `${b64(header)}.${b64(payload)}`;
const sig = createHmac("sha256", secret).update(data).digest("base64url");
console.log(`${data}.${sig}`);
