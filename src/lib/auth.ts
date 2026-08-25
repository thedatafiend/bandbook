import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getBandCookie } from "@/lib/session";
import type { Member, Band } from "@/lib/supabase/types";

export interface AuthContext {
  userId: string;
  member: Member;
  band: Band;
}

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

  return { userId, member, band };
}
