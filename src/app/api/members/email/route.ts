import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { email } = body as { email?: string };

  if (!email?.trim() || !email.includes("@")) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("members")
    .update({ email: email.trim().toLowerCase() })
    .eq("id", auth.member.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ email: email.trim().toLowerCase() });
}
