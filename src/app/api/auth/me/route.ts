import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionCookies } from "@/lib/session";
import type { Member, Band } from "@/lib/supabase/types";

export async function GET() {
  const { sessionToken, bandId } = await getSessionCookies();

  if (!sessionToken || !bandId) {
    return NextResponse.json({ member: null, band: null });
  }

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("session_token", sessionToken)
    .eq("band_id", bandId)
    .single<Member>();

  if (!member) {
    // Cookies exist but session is invalid/expired — return 401
    return NextResponse.json(
      { member: null, band: null, expired: true },
      { status: 401 }
    );
  }

  // Update last_active_at
  await supabase
    .from("members")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", member.id);

  const { data: band } = await supabase
    .from("bands")
    .select("id, name, invite_token")
    .eq("id", bandId)
    .single<Pick<Band, "id" | "name" | "invite_token">>();

  return NextResponse.json({ member, band });
}
