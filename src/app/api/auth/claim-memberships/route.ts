import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { setBandCookie } from "@/lib/session";

/**
 * Claims any existing member records that match the current Clerk user's
 * email but haven't been linked to a Clerk account yet.
 *
 * This handles the migration path for users who had bands before Clerk
 * was introduced — they sign up with the same email and their old
 * memberships are automatically linked.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) {
    return NextResponse.json({ claimed: [], count: 0 });
  }

  const supabase = await createClient();

  // Find unlinked members matching this email
  const { data: unlinked } = await supabase
    .from("members")
    .select("id, band_id, nickname, bands(id, name)")
    .is("clerk_user_id", null)
    .ilike("email", email.toLowerCase());

  if (!unlinked || unlinked.length === 0) {
    return NextResponse.json({ claimed: [], count: 0 });
  }

  // Claim them by setting clerk_user_id
  const memberIds = unlinked.map((m: { id: string }) => m.id);

  const { error: updateError } = await supabase
    .from("members")
    .update({ clerk_user_id: userId })
    .in("id", memberIds);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to claim memberships" },
      { status: 500 }
    );
  }

  const claimed = unlinked.map((m: Record<string, unknown>) => {
    const band = m.bands as { id: string; name: string } | null;
    return {
      member_id: m.id,
      band_id: m.band_id,
      band_name: band?.name ?? "Unknown",
      nickname: m.nickname,
    };
  });

  // If the user has exactly one band, set it as active automatically
  if (claimed.length === 1) {
    await setBandCookie(claimed[0].band_id as string);
  }

  return NextResponse.json({ claimed, count: claimed.length });
}
