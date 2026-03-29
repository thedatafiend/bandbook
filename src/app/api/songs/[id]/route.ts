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

  // Fetch song, versions, and lyrics in parallel instead of sequentially
  const [songResult, versionsResult, lyricsResult] = await Promise.all([
    supabase
      .from("songs")
      .select("*")
      .eq("id", id)
      .eq("band_id", auth.band.id)
      .single(),
    supabase
      .from("versions")
      .select("id, version_number, label, audio_url, audio_duration, notes, is_current, created_at, created_by_member_id")
      .eq("song_id", id)
      .order("version_number", { ascending: false }),
    supabase
      .from("lyric_sections")
      .select("id, section_type, section_label, content, sort_order, updated_at, updated_by_member_id")
      .eq("song_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  const song = songResult.data;
  if (songResult.error || !song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const versions = versionsResult.data ?? [];
  const lyricSections = lyricsResult.data ?? [];

  // Collect all member IDs for attribution
  const memberIds = new Set<string>();
  for (const v of versions) {
    memberIds.add(v.created_by_member_id);
  }
  for (const s of lyricSections) {
    if (s.updated_by_member_id) memberIds.add(s.updated_by_member_id);
  }

  // Fetch members and generate signed URLs in parallel
  const audioUrls = versions.filter((v) => v.audio_url).map((v) => v.audio_url);

  const [memberMap, signedUrlMap] = await Promise.all([
    // Fetch member nicknames
    (async () => {
      const map: Record<string, string> = {};
      if (memberIds.size > 0) {
        const { data: members } = await supabase
          .from("members")
          .select("id, nickname")
          .in("id", [...memberIds]);
        if (members) {
          for (const m of members) {
            map[m.id] = m.nickname;
          }
        }
      }
      return map;
    })(),
    // Batch-generate signed URLs for all audio files
    (async () => {
      const map: Record<string, string> = {};
      if (audioUrls.length > 0) {
        const { data: signedData } = await supabase.storage
          .from("audio")
          .createSignedUrls(audioUrls, 3600);
        if (signedData) {
          for (const entry of signedData) {
            if (entry.signedUrl && entry.path) {
              map[entry.path] = entry.signedUrl;
            }
          }
        }
      }
      return map;
    })(),
  ]);

  const versionsWithDetails = versions.map((v) => ({
    ...v,
    signed_audio_url: v.audio_url ? (signedUrlMap[v.audio_url] ?? null) : null,
    created_by_nickname: memberMap[v.created_by_member_id] ?? "Unknown",
  }));

  const lyricSectionsWithNicknames = lyricSections.map((s) => ({
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
