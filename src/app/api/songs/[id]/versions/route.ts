import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { Version } from "@/lib/supabase/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: songId } = await params;
  const supabase = await createClient();

  // Verify song belongs to band
  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("id, band_id")
    .eq("id", songId)
    .eq("band_id", auth.band.id)
    .single();

  if (songError || !song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const label = (formData.get("label") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!file) {
    return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
  }

  // Validate file size (500 MB max)
  const MAX_SIZE = 500 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 500 MB)" }, { status: 400 });
  }

  // Get next version number
  const { data: maxVersionRow } = await supabase
    .from("versions")
    .select("version_number")
    .eq("song_id", songId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  const nextVersionNumber = maxVersionRow ? maxVersionRow.version_number + 1 : 1;
  const isFirst = nextVersionNumber === 1;

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() || "mp3";
  const storagePath = `${auth.band.id}/${songId}/${nextVersionNumber}-${Date.now()}.${ext}`;

  const fileBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("audio")
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "audio/mpeg",
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json(
      { error: `Failed to upload audio file: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // If not the first version, unmark all existing versions as current
  if (!isFirst) {
    await supabase
      .from("versions")
      .update({ is_current: false })
      .eq("song_id", songId);
  }

  // Create version record
  const { data: version, error: versionError } = await supabase
    .from("versions")
    .insert({
      song_id: songId,
      version_number: nextVersionNumber,
      label,
      audio_url: storagePath,
      notes,
      is_current: true,
      created_by_member_id: auth.member.id,
    })
    .select()
    .single<Version>();

  if (versionError || !version) {
    return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
  }

  // Update song's current_version_id
  await supabase
    .from("songs")
    .update({
      current_version_id: version.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", songId);

  return NextResponse.json({ version });
}
