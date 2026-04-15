import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { setBandCookie } from "@/lib/session";

/**
 * Switch the active band context by updating the bb_band cookie.
 * Verifies the user actually has a membership in the target band.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { bandId } = body as { bandId?: string };

  if (!bandId) {
    return NextResponse.json({ error: "Band ID is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify this user has a membership in the target band
  const { data: member } = await supabase
    .from("members")
    .select("id, nickname")
    .eq("clerk_user_id", userId)
    .eq("band_id", bandId)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Not a member of this band" }, { status: 403 });
  }

  await setBandCookie(bandId);

  return NextResponse.json({ ok: true });
}
