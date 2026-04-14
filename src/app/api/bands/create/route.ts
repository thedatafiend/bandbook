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
  const { bandName, passcode, nickname } = body as {
    bandName?: string;
    passcode?: string;
    nickname?: string;
  };

  if (!bandName?.trim()) {
    return NextResponse.json({ error: "Band name is required" }, { status: 400 });
  }
  if (!passcode || passcode.length < 4 || passcode.length > 8) {
    return NextResponse.json(
      { error: "Passcode must be 4–8 characters" },
      { status: 400 }
    );
  }
  if (!nickname?.trim()) {
    return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const passcodeHash = await bcrypt.hash(passcode, 10);

  const { data: band, error: bandError } = await supabase
    .from("bands")
    .insert({ name: bandName.trim(), passcode_hash: passcodeHash })
    .select()
    .single<Band>();

  if (bandError || !band) {
    return NextResponse.json({ error: "Failed to create band" }, { status: 500 });
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      band_id: band.id,
      nickname: nickname.trim(),
      clerk_user_id: userId,
      role: "admin",
    })
    .select()
    .single<Member>();

  if (memberError || !member) {
    return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
  }

  await setBandCookie(band.id);

  return NextResponse.json({
    band: { id: band.id, name: band.name, invite_token: band.invite_token },
    member: { id: member.id, nickname: member.nickname },
  });
}
