import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

export async function POST() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const newToken = crypto.randomBytes(16).toString("hex");

  const { data: band, error } = await supabase
    .from("bands")
    .update({ invite_token: newToken })
    .eq("id", auth.band.id)
    .select("invite_token")
    .single();

  if (error || !band) {
    return NextResponse.json({ error: "Failed to regenerate invite link" }, { status: 500 });
  }

  return NextResponse.json({ invite_token: band.invite_token });
}
