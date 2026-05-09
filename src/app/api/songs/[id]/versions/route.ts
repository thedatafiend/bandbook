import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { Version } from "@/lib/supabase/types";

// Registers an already-uploaded audio file as a new version. The file itself
// is uploaded directly from the browser to Supabase Storage via a signed URL
// (see /upload-url), so this endpoint only handles a small JSON body and
// avoids Vercel's ~4.5MB function payload limit.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: songId } = await params;
    const supabase = await createClient();

    const { data: song, error: songError } = await supabase
      .from("songs")
      .select("id, band_id")
      .eq("id", songId)
      .eq("band_id", auth.band.id)
      .single();

    if (songError || !song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as {
      path?: unknown;
      label?: unknown;
      notes?: unknown;
    } | null;

    const path = typeof body?.path === "string" ? body.path : "";
    const label = typeof body?.label === "string" ? body.label : null;
    const notes = typeof body?.notes === "string" ? body.notes : null;

    if (!path) {
      return NextResponse.json({ error: "Storage path is required" }, { status: 400 });
    }

    // Reject paths that weren't issued for this band+song. Without this a
    // member could register someone else's audio object as one of their songs.
    const expectedPrefix = `${auth.band.id}/${songId}/`;
    if (!path.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
    }

    const { data: maxVersionRow } = await supabase
      .from("versions")
      .select("version_number")
      .eq("song_id", songId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersionNumber = maxVersionRow ? maxVersionRow.version_number + 1 : 1;
    const isFirst = nextVersionNumber === 1;

    if (!isFirst) {
      await supabase
        .from("versions")
        .update({ is_current: false })
        .eq("song_id", songId);
    }

    const { data: version, error: versionError } = await supabase
      .from("versions")
      .insert({
        song_id: songId,
        version_number: nextVersionNumber,
        label,
        audio_url: path,
        notes,
        is_current: true,
        created_by_member_id: auth.member.id,
      })
      .select()
      .single<Version>();

    if (versionError || !version) {
      console.error("Version insert error:", versionError);
      return NextResponse.json(
        { error: `Failed to create version: ${versionError?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

    await supabase
      .from("songs")
      .update({
        current_version_id: version.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", songId);

    return NextResponse.json({ version });
  } catch (err) {
    console.error("Unhandled error in POST /api/songs/[id]/versions:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
