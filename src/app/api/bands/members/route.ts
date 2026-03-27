import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("members")
    .select("id, nickname, created_at, last_active_at")
    .eq("band_id", auth.band.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }

  return NextResponse.json({ members });
}
