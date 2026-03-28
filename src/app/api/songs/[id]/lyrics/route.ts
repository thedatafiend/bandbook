import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

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

  // Verify song belongs to this band
  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("id, band_id")
    .eq("id", songId)
    .eq("band_id", auth.band.id)
    .single();

  if (songError || !song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const body = await request.json();
  const sections: Array<{
    id?: string;
    section_type: string;
    section_label?: string | null;
    content: string;
    sort_order: number;
  }> = body.sections;

  if (!Array.isArray(sections)) {
    return NextResponse.json(
      { error: "sections array required" },
      { status: 400 }
    );
  }

  // Delete all existing sections for this song
  await supabase.from("lyric_sections").delete().eq("song_id", songId);

  // Insert new sections
  const now = new Date().toISOString();
  const rows = sections.map((s, i) => ({
    song_id: songId,
    section_type: s.section_type,
    section_label: s.section_label ?? null,
    content: s.content,
    sort_order: s.sort_order ?? i,
    updated_at: now,
    updated_by_member_id: auth.member.id,
  }));

  let savedSections: Array<Record<string, unknown>> = [];
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("lyric_sections")
      .insert(rows)
      .select("id, section_type, section_label, content, sort_order, updated_at, updated_by_member_id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    savedSections = data ?? [];
  }

  // Create a lyric revision snapshot
  const snapshot = {
    sections: savedSections.map((s) => ({
      section_type: s.section_type,
      section_label: s.section_label,
      content: s.content,
      sort_order: s.sort_order,
    })),
  };

  const { data: revision } = await supabase
    .from("lyric_revisions")
    .insert({
      song_id: songId,
      snapshot,
      created_by_member_id: auth.member.id,
    })
    .select("id, created_at")
    .single();

  // Update song's updated_at
  await supabase
    .from("songs")
    .update({ updated_at: now })
    .eq("id", songId);

  return NextResponse.json({
    sections: savedSections,
    revision_id: revision?.id ?? null,
    revision_created_at: revision?.created_at ?? null,
  });
}
