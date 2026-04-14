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

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("clerk_user_id", userId)
    .eq("band_id", bandId)
    .single<Member>();

  if (!member) return null;

  const { data: band } = await supabase
    .from("bands")
    .select("*")
    .eq("id", bandId)
    .single<Band>();

  if (!band) return null;

  return { userId, member, band };
}
