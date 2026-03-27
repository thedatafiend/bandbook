import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("*")
    .eq("id", id)
    .eq("band_id", auth.band.id)
    .single();

  if (songError || !song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const { data: versions } = await supabase
    .from("versions")
    .select("id, version_number, label, audio_url, audio_duration, notes, is_current, created_at, created_by_member_id")
    .eq("song_id", id)
    .order("version_number", { ascending: false });

  // Fetch member nicknames for version attribution
  const memberIds = [
    ...new Set((versions ?? []).map((v) => v.created_by_member_id)),
  ];
  let memberMap: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("id, nickname")
      .in("id", memberIds);
    if (members) {
      for (const m of members) {
        memberMap[m.id] = m.nickname;
      }
    }
  }

  const versionsWithNicknames = (versions ?? []).map((v) => ({
    ...v,
    created_by_nickname: memberMap[v.created_by_member_id] ?? "Unknown",
  }));

  return NextResponse.json({
    song: { ...song, versions: versionsWithNicknames },
  });
}
