import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  // Verify song belongs to band
  const { data: song } = await supabase
    .from("songs")
    .select("id")
    .eq("id", id)
    .eq("band_id", auth.band.id)
    .single();

  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const body = await request.json();
  const { title } = body as { title?: string };

  const updates: Record<string, unknown> = {};
  if (title !== undefined) {
    const trimmed = title.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    updates.title = trimmed;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("songs")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update song" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

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

  // Fetch lyric sections ordered by sort_order
  const { data: lyricSections } = await supabase
    .from("lyric_sections")
    .select("id, section_type, section_label, content, sort_order, updated_at, updated_by_member_id")
    .eq("song_id", id)
    .order("sort_order", { ascending: true });

  // Collect all member IDs for attribution
  const memberIds = new Set<string>();
  for (const v of versions ?? []) {
    memberIds.add(v.created_by_member_id);
  }
  for (const s of lyricSections ?? []) {
    if (s.updated_by_member_id) memberIds.add(s.updated_by_member_id);
  }

  let memberMap: Record<string, string> = {};
  if (memberIds.size > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("id, nickname")
      .in("id", [...memberIds]);
    if (members) {
      for (const m of members) {
        memberMap[m.id] = m.nickname;
      }
    }
  }

  // Generate signed URLs for audio playback (1 hour expiry)
  const versionsWithDetails = await Promise.all(
    (versions ?? []).map(async (v) => {
      let signedAudioUrl: string | null = null;
      if (v.audio_url) {
        const { data: signedData } = await supabase.storage
          .from("audio")
          .createSignedUrl(v.audio_url, 3600);
        signedAudioUrl = signedData?.signedUrl ?? null;
      }
      return {
        ...v,
        signed_audio_url: signedAudioUrl,
        created_by_nickname: memberMap[v.created_by_member_id] ?? "Unknown",
      };
    })
  );

  const lyricSectionsWithNicknames = (lyricSections ?? []).map((s) => ({
    ...s,
    updated_by_nickname: s.updated_by_member_id
      ? memberMap[s.updated_by_member_id] ?? "Unknown"
      : null,
  }));

  return NextResponse.json({
    song: {
      ...song,
      versions: versionsWithDetails,
      lyric_sections: lyricSectionsWithNicknames,
    },
  });
}
