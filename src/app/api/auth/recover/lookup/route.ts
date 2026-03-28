import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { email } = body as { email?: string };

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, nickname, band_id, bands(id, name)")
    .ilike("email", email.trim().toLowerCase());

  const results = (members ?? []).map((m: Record<string, unknown>) => {
    const band = m.bands as { id: string; name: string } | null;
    return {
      member_id: m.id,
      band_id: m.band_id,
      band_name: band?.name ?? "Unknown",
      nickname: m.nickname,
    };
  });

  return NextResponse.json({ bands: results });
}
