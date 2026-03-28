import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { setSessionCookies } from "@/lib/session";
import type { Member, Band } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const body = await request.json();
  const { memberId, passcode } = body as {
    memberId?: string;
    passcode?: string;
  };

  if (!memberId || !passcode) {
    return NextResponse.json(
      { error: "Member ID and passcode are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .single<Member>();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const { data: band } = await supabase
    .from("bands")
    .select("*")
    .eq("id", member.band_id)
    .single<Band>();

  if (!band) {
    return NextResponse.json({ error: "Band not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(passcode, band.passcode_hash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  // Rotate session token to invalidate any old sessions
  const newToken = crypto.randomBytes(32).toString("hex");

  const { error: updateError } = await supabase
    .from("members")
    .update({
      session_token: newToken,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", member.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to recover session" },
      { status: 500 }
    );
  }

  await setSessionCookies(newToken, band.id);

  return NextResponse.json({
    band: { id: band.id, name: band.name },
    member: { id: member.id, nickname: member.nickname },
  });
}
