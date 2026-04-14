import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { setBandCookie } from "@/lib/session";

/**
 * Claims any unclaimed member records matching the user's email, then
 * returns ALL bands the user belongs to (both newly claimed and
 * previously linked).
 *
 * This handles:
 * - Migration backfill: existing members get linked on first sign-in
 * - Returning users: always returns their bands for redirect/picker
 * - New users: returns empty list so they can create/join a band
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Step 1: Claim any unclaimed members matching this user's email
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (email) {
    const { data: unlinked } = await supabase
      .from("members")
      .select("id")
      .is("clerk_user_id", null)
      .ilike("email", email.toLowerCase());

    if (unlinked && unlinked.length > 0) {
      const memberIds = unlinked.map((m: { id: string }) => m.id);
      await supabase
        .from("members")
        .update({ clerk_user_id: userId })
        .in("id", memberIds);
    }
  }

  // Step 2: Return ALL bands this user belongs to
  const { data: memberships } = await supabase
    .from("members")
    .select("id, band_id, nickname, bands(id, name)")
    .eq("clerk_user_id", userId);

  const bands = (memberships ?? []).map((m: Record<string, unknown>) => {
    const band = m.bands as { id: string; name: string } | null;
    return {
      member_id: m.id,
      band_id: m.band_id,
      band_name: band?.name ?? "Unknown",
      nickname: m.nickname,
    };
  });

  // If the user has exactly one band, set it as active automatically
  if (bands.length === 1) {
    await setBandCookie(bands[0].band_id as string);
  }

  return NextResponse.json({ bands, count: bands.length });
}
