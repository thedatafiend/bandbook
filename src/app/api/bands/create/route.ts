import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { setSessionCookies } from "@/lib/session";
import type { Band, Member } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const body = await request.json();
  const { bandName, passcode, nickname, email } = body as {
    bandName?: string;
    passcode?: string;
    nickname?: string;
    email?: string;
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
  if (!email?.trim() || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
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
    .insert({ band_id: band.id, nickname: nickname.trim(), email: email.trim().toLowerCase() })
    .select()
    .single<Member>();

  if (memberError || !member) {
    return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
  }

  await setSessionCookies(member.session_token, band.id);

  return NextResponse.json({
    band: { id: band.id, name: band.name, invite_token: band.invite_token },
    member: { id: member.id, nickname: member.nickname },
  });
}
