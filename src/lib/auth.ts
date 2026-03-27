import { createClient } from "@/lib/supabase/server";
import { getSessionCookies } from "@/lib/session";
import type { Member, Band } from "@/lib/supabase/types";

export interface AuthContext {
  member: Member;
  band: Band;
}

/**
 * Verify the current session and return the authenticated member + band.
 * Returns null if the session is invalid.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const { sessionToken, bandId } = await getSessionCookies();
  if (!sessionToken || !bandId) return null;

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("session_token", sessionToken)
    .eq("band_id", bandId)
    .single<Member>();

  if (!member) return null;

  const { data: band } = await supabase
    .from("bands")
    .select("*")
    .eq("id", bandId)
    .single<Band>();

  if (!band) return null;

  return { member, band };
}
