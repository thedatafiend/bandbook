import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { currentPasscode, newPasscode } = body as {
    currentPasscode?: string;
    newPasscode?: string;
  };

  if (!currentPasscode) {
    return NextResponse.json({ error: "Current passcode is required" }, { status: 400 });
  }
  if (!newPasscode || newPasscode.length < 4 || newPasscode.length > 8) {
    return NextResponse.json(
      { error: "New passcode must be 4–8 characters" },
      { status: 400 }
    );
  }

  // Verify current passcode
  const valid = await bcrypt.compare(currentPasscode, auth.band.passcode_hash);
  if (!valid) {
    return NextResponse.json({ error: "Current passcode is incorrect" }, { status: 401 });
  }

  const supabase = await createClient();
  const newHash = await bcrypt.hash(newPasscode, 10);

  const { error } = await supabase
    .from("bands")
    .update({ passcode_hash: newHash })
    .eq("id", auth.band.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update passcode" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
