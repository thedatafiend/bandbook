import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { Song } from "@/lib/supabase/types";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: songs, error } = await supabase
    .from("songs")
    .select("*")
    .eq("band_id", auth.band.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch songs" }, { status: 500 });
  }

  // Get version counts per song
  const songIds = (songs ?? []).map((s) => s.id);
  let versionCounts: Record<string, number> = {};

  if (songIds.length > 0) {
    const { data: versions } = await supabase
      .from("versions")
      .select("song_id")
      .in("song_id", songIds);

    if (versions) {
      for (const v of versions) {
        versionCounts[v.song_id] = (versionCounts[v.song_id] ?? 0) + 1;
      }
    }
  }

  const result = (songs ?? []).map((song) => ({
    id: song.id,
    title: song.title,
    status: song.status,
    current_version_id: song.current_version_id,
    created_at: song.created_at,
    updated_at: song.updated_at,
    created_by_member_id: song.created_by_member_id,
    version_count: versionCounts[song.id] ?? 0,
  }));

  return NextResponse.json({ songs: result });
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title } = body as { title?: string };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Song title is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: song, error } = await supabase
    .from("songs")
    .insert({
      band_id: auth.band.id,
      title: title.trim(),
      created_by_member_id: auth.member.id,
    })
    .select()
    .single<Song>();

  if (error || !song) {
    return NextResponse.json({ error: "Failed to create song" }, { status: 500 });
  }

  return NextResponse.json({ song });
}
