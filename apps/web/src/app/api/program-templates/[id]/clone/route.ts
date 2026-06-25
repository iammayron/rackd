import { PROGRAM_TEMPLATES, cloneProgramTemplate } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

/** POST /api/program-templates/[id]/clone — clone a starter program into the caller's data. */
export const POST = withUser(async (ownerId, _req, ctx) => {
  const { id } = await ctx.params;
  const tpl = PROGRAM_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return Response.json({ error: "Not found" }, { status: 404 });
  const programId = await cloneProgramTemplate(tpl, ownerId);
  return Response.json({ id: programId }, { status: 201 });
});
