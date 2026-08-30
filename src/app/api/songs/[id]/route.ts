import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { getSongDetail } from "@/lib/queries";

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
  const { title, bpm, status } = body as {
    title?: string;
    bpm?: number | null;
    status?: string;
  };

  const updates: Record<string, unknown> = {};
  if (title !== undefined) {
    const trimmed = title.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    updates.title = trimmed;
  }
  if (bpm !== undefined) {
    if (bpm === null) {
      updates.bpm = null;
    } else if (
      typeof bpm !== "number" ||
      !Number.isFinite(bpm) ||
      !Number.isInteger(bpm) ||
      bpm < 1 ||
      bpm > 999
    ) {
      return NextResponse.json(
        { error: "BPM must be an integer between 1 and 999" },
        { status: 400 }
      );
    } else {
      updates.bpm = bpm;
    }
  }
  if (status !== undefined) {
    if (status !== "draft" && status !== "in-progress" && status !== "finished") {
      return NextResponse.json(
        { error: "Status must be one of: draft, in-progress, finished" },
        { status: 400 }
      );
    }
    updates.status = status;
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

export async function DELETE(
  _request: Request,
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

  // Remove associated audio files from storage. DB cascades take care of the
  // versions, lyric_sections, and lyric_revisions rows, but storage objects
  // are not cascaded, so we clean them up explicitly before deleting the song.
  const { data: versions } = await supabase
    .from("versions")
    .select("audio_url")
    .eq("song_id", id);

  const audioUrls = (versions ?? [])
    .map((v) => v.audio_url)
    .filter((url): url is string => Boolean(url));

  if (audioUrls.length > 0) {
    await supabase.storage.from("audio").remove(audioUrls);
  }

  const { error: deleteError } = await supabase
    .from("songs")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete song" }, { status: 500 });
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

  let song;
  try {
    song = await getSongDetail(supabase, id, auth.band.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load song";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  return NextResponse.json({ song });
}
