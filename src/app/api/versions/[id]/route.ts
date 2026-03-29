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

  const { id: versionId } = await params;
  const supabase = await createClient();

  // Verify version exists and belongs to band's song
  const { data: version, error: vError } = await supabase
    .from("versions")
    .select("id, song_id, songs!inner(band_id)")
    .eq("id", versionId)
    .single();

  if (vError || !version) {
    // Fallback: query without join
    const { data: v2 } = await supabase
      .from("versions")
      .select("id, song_id")
      .eq("id", versionId)
      .single();

    if (!v2) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const { data: song } = await supabase
      .from("songs")
      .select("band_id")
      .eq("id", v2.song_id)
      .eq("band_id", auth.band.id)
      .single();

    if (!song) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
  }

  const body = await request.json();
  const { label, notes, setCurrent } = body as {
    label?: string;
    notes?: string;
    setCurrent?: boolean;
  };

  // Build update object
  const updates: Record<string, unknown> = {};
  if (label !== undefined) updates.label = label || null;
  if (notes !== undefined) updates.notes = notes || null;

  // If setting as current, unmark all others first
  if (setCurrent) {
    // Get the song_id for this version
    const { data: ver } = await supabase
      .from("versions")
      .select("song_id")
      .eq("id", versionId)
      .single();

    if (ver) {
      await supabase
        .from("versions")
        .update({ is_current: false })
        .eq("song_id", ver.song_id);

      updates.is_current = true;

      // Update song's current_version_id
      await supabase
        .from("songs")
        .update({
          current_version_id: versionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ver.song_id);
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("versions")
      .update(updates)
      .eq("id", versionId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update version" }, { status: 500 });
    }
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

  const { id: versionId } = await params;
  const supabase = await createClient();

  // Fetch version with its audio_url and song_id
  const { data: version } = await supabase
    .from("versions")
    .select("id, song_id, audio_url, is_current")
    .eq("id", versionId)
    .single();

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Verify the version's song belongs to the authenticated band
  const { data: song } = await supabase
    .from("songs")
    .select("id, band_id")
    .eq("id", version.song_id)
    .eq("band_id", auth.band.id)
    .single();

  if (!song) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Delete the audio file from storage
  if (version.audio_url) {
    await supabase.storage.from("audio").remove([version.audio_url]);
  }

  // Delete the version record
  const { error: deleteError } = await supabase
    .from("versions")
    .delete()
    .eq("id", versionId);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete version" }, { status: 500 });
  }

  // If this was the current version, reassign current to the latest remaining version
  if (version.is_current) {
    const { data: latest } = await supabase
      .from("versions")
      .select("id")
      .eq("song_id", version.song_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      await supabase
        .from("versions")
        .update({ is_current: true })
        .eq("id", latest.id);

      await supabase
        .from("songs")
        .update({
          current_version_id: latest.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", version.song_id);
    } else {
      // No versions left — clear current_version_id
      await supabase
        .from("songs")
        .update({
          current_version_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", version.song_id);
    }
  }

  return NextResponse.json({ success: true });
}
