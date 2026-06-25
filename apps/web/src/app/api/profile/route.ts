import { getProfile, updateProfile } from "@rackd/db";
import { withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

/** GET /api/profile — the caller's profile, creating a default row if none exists. */
export const GET = withUser(async (ownerId) => {
  const profile = await getProfile(ownerId);
  return Response.json(profile);
});

/** PUT /api/profile — update allowed profile fields for the caller. */
export const PUT = withUser(async (ownerId, req) => {
  const body = await req.json();
  const profile = await updateProfile(ownerId, body);
  return Response.json(profile);
});
