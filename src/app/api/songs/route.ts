import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { Song } from "@/lib/supabase/types";

interface SongWithCounts {
  id: string;
  title: string;
  status: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  created_by_member_id: string;
  versions: Array<{ count: number }>;
  lyric_sections: Array<{ count: number }>;
}

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // One round trip: songs with version/lyric counts aggregated in-database,
  // instead of fetching every version and lyric row just to count them.
  const { data: songs, error } = await supabase
    .from("songs")
    .select(
      "id, title, status, current_version_id, created_at, updated_at, created_by_member_id, versions(count), lyric_sections(count)"
    )
    .eq("band_id", auth.band.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch songs" }, { status: 500 });
  }

  const result = ((songs ?? []) as unknown as SongWithCounts[]).map((song) => ({
    id: song.id,
    title: song.title,
    status: song.status,
    current_version_id: song.current_version_id,
    created_at: song.created_at,
    updated_at: song.updated_at,
    created_by_member_id: song.created_by_member_id,
    version_count: song.versions?.[0]?.count ?? 0,
    has_lyrics: (song.lyric_sections?.[0]?.count ?? 0) > 0,
  }));

  // Include the caller's member/band context (already loaded by
  // getAuthContext) so the songs page needs a single fetch.
  return NextResponse.json({
    songs: result,
    member: { nickname: auth.member.nickname },
    band: { name: auth.band.name, invite_token: auth.band.invite_token },
  });
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
