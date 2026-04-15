import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { setBandCookie } from "@/lib/session";
import type { Band, Member } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { inviteToken, passcode, nickname } = body as {
    inviteToken?: string;
    passcode?: string;
    nickname?: string;
  };

  if (!inviteToken) {
    return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
  }
  if (!passcode) {
    return NextResponse.json({ error: "Passcode is required" }, { status: 400 });
  }
  if (!nickname?.trim()) {
    return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: band, error: bandError } = await supabase
    .from("bands")
    .select("*")
    .eq("invite_token", inviteToken)
    .single<Band>();

  if (bandError || !band) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  }

  const valid = await bcrypt.compare(passcode, band.passcode_hash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      band_id: band.id,
      nickname: nickname.trim(),
      clerk_user_id: userId,
      role: "member",
    })
    .select()
    .single<Member>();

  if (memberError || !member) {
    return NextResponse.json({ error: "Failed to join band" }, { status: 500 });
  }

  await setBandCookie(band.id);

  return NextResponse.json({
    band: { id: band.id, name: band.name },
    member: { id: member.id, nickname: member.nickname },
  });
}
