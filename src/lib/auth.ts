import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getBandCookie } from "@/lib/session";
import type { Member, Band } from "@/lib/supabase/types";

export interface AuthContext {
  userId: string;
  member: Member;
  band: Band;
}

/** Only write last_active_at when the stored value is older than this. */
const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Verify the current Clerk session and return the authenticated user's
 * membership + band for the active band context.
 * Returns null if unauthenticated or no matching membership.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const bandId = await getBandCookie();
  if (!bandId) return null;

  const supabase = await createClient();

  // Single round trip: membership row with its band embedded.
  const { data } = await supabase
    .from("members")
    .select("*, bands(*)")
    .eq("clerk_user_id", userId)
    .eq("band_id", bandId)
    .single<Member & { bands: Band | null }>();

  if (!data) return null;

  const { bands: band, ...member } = data;
  if (!band) return null;

  // Track member activity, throttled so authenticated reads aren't a write
  // on every request. (Pages no longer call /api/auth/me, which used to do
  // this.)
  const lastActive = member.last_active_at
    ? new Date(member.last_active_at).getTime()
    : 0;
  if (Date.now() - lastActive > LAST_ACTIVE_THROTTLE_MS) {
    await supabase
      .from("members")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", member.id);
  }

  return { userId, member, band };
}
