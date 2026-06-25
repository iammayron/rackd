import { deleteAccountData } from "@rackd/db";
import { deleteAuthUser, withUser } from "@/lib/api-auth";

export const runtime = "nodejs";

/**
 * DELETE /api/account — permanently delete the caller's account. Wipes all of
 * their owned data first (one transaction in @rackd/db), then removes the
 * Supabase auth user via the service-role admin API. Public shared routines are
 * intentionally left behind. Irreversible.
 */
export const DELETE = withUser(async (ownerId) => {
  await deleteAccountData(ownerId);
  await deleteAuthUser(ownerId);
  return new Response(null, { status: 204 });
});
