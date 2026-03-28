import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// GET /api/songs/[id]/lyrics/revisions — list revision history
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: songId } = await params;
  const supabase = await createClient();

  // Verify song belongs to band
  const { data: song } = await supabase
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("band_id", auth.band.id)
    .single();

  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const { data: revisions } = await supabase
    .from("lyric_revisions")
    .select("id, snapshot, created_at, created_by_member_id, revision_note")
    .eq("song_id", songId)
    .order("created_at", { ascending: false });

  // Resolve member nicknames
  const memberIds = new Set<string>();
  for (const r of revisions ?? []) {
    memberIds.add(r.created_by_member_id);
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

  const revisionsWithNicknames = (revisions ?? []).map((r: { id: string; snapshot: unknown; created_at: string; created_by_member_id: string; revision_note: string | null }) => ({
    ...r,
    created_by_nickname: memberMap[r.created_by_member_id] ?? "Unknown",
  }));

  return NextResponse.json({ revisions: revisionsWithNicknames });
}

// POST /api/songs/[id]/lyrics/revisions — restore a revision
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
  const { data: song } = await supabase
    .from("songs")
    .select("id")
    .eq("id", songId)
    .eq("band_id", auth.band.id)
    .single();

  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const body = await request.json();
  const { revisionId } = body;

  if (!revisionId) {
    return NextResponse.json(
      { error: "revisionId required" },
      { status: 400 }
    );
  }

  // Fetch the revision to restore
  const { data: revision } = await supabase
    .from("lyric_revisions")
    .select("snapshot")
    .eq("id", revisionId)
    .eq("song_id", songId)
    .single();

  if (!revision) {
    return NextResponse.json(
      { error: "Revision not found" },
      { status: 404 }
    );
  }

  const snapshot = revision.snapshot as { sections: Array<{
    section_type: string;
    section_label: string | null;
    content: string;
    sort_order: number;
  }> };

  // Delete current sections
  await supabase.from("lyric_sections").delete().eq("song_id", songId);

  // Insert sections from snapshot
  const now = new Date().toISOString();
  const rows = (snapshot.sections ?? []).map((s, i) => ({
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
    const { data } = await supabase
      .from("lyric_sections")
      .insert(rows)
      .select("id, section_type, section_label, content, sort_order, updated_at, updated_by_member_id");
    savedSections = data ?? [];
  }

  // Create a new revision for the restore action
  const { data: newRevision } = await supabase
    .from("lyric_revisions")
    .insert({
      song_id: songId,
      snapshot,
      created_by_member_id: auth.member.id,
      revision_note: "Restored from earlier revision",
    })
    .select("id, created_at")
    .single();

  await supabase
    .from("songs")
    .update({ updated_at: now })
    .eq("id", songId);

  return NextResponse.json({
    sections: savedSections,
    revision_id: newRevision?.id ?? null,
    revision_created_at: newRevision?.created_at ?? null,
  });
}
