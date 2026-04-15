import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getBandCookie } from "@/lib/session";
import type { Member, Band } from "@/lib/supabase/types";

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

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("clerk_user_id", userId)
    .eq("band_id", bandId)
    .single<Member>();

  if (!member) {
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
