import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getBandCookie } from "@/lib/session";
import type { Member, Band } from "@/lib/supabase/types";

/** Only write last_active_at when the stored value is older than this. */
const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ member: null, band: null });
  }

  const bandId = await getBandCookie();

  if (!bandId) {
    return NextResponse.json({ member: null, band: null });
  }

  const supabase = await createClient();

  // Single round trip: membership row with its band embedded.
  const { data } = await supabase
    .from("members")
    .select("*, bands(id, name, invite_token)")
    .eq("clerk_user_id", userId)
    .eq("band_id", bandId)
    .single<Member & { bands: Pick<Band, "id" | "name" | "invite_token"> | null }>();

  if (!data) {
    return NextResponse.json(
      { member: null, band: null, expired: true },
      { status: 401 }
    );
  }

  const { bands: band, ...member } = data;

  // Update last_active_at, throttled so this hot read path isn't a write
  // on every page view.
  const lastActive = member.last_active_at
    ? new Date(member.last_active_at).getTime()
    : 0;
  if (Date.now() - lastActive > LAST_ACTIVE_THROTTLE_MS) {
    await supabase
      .from("members")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", member.id);
  }

  return NextResponse.json({ member, band });
}
