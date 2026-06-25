import { PROGRAM_TEMPLATES } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

/** GET /api/program-templates — the built-in starter programs (static catalog). */
export const GET = withUser(async () => {
  return Response.json(PROGRAM_TEMPLATES);
});
