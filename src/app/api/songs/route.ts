import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { listSongs } from "@/lib/queries";
import type { Song } from "@/lib/supabase/types";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const songs = await listSongs(supabase, auth.band.id);

  if (songs === null) {
    return NextResponse.json({ error: "Failed to fetch songs" }, { status: 500 });
  }

  // Include the caller's member/band context (already loaded by
  // getAuthContext) so clients need a single fetch.
  return NextResponse.json({
    songs,
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
