import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

export async function PATCH(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name } = body as { name?: string };

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  const trimmed = name.trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("bands")
    .update({ name: trimmed })
    .eq("id", auth.band.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update band name" }, { status: 500 });
  }

  return NextResponse.json({ success: true, name: trimmed });
}
