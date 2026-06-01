import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { generateShareToken } from "@/lib/shares";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Confirm the version exists and its song belongs to the given band.
 * Returns true when the caller is allowed to manage shares for this version.
 */
async function versionBelongsToBand(
  supabase: SupabaseClient,
  versionId: string,
  bandId: string
): Promise<boolean> {
  const { data: version } = await supabase
    .from("versions")
    .select("id, song_id")
    .eq("id", versionId)
    .single();

  if (!version) return false;

  const { data: song } = await supabase
    .from("songs")
    .select("id")
    .eq("id", version.song_id)
    .eq("band_id", bandId)
    .single();

  return Boolean(song);
}

function shareUrl(request: Request, token: string): string {
  return new URL(`/share/${token}`, request.url).toString();
}

// Create a share link for this version (or return the existing active one).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: versionId } = await params;
  const supabase = await createClient();

  if (!(await versionBelongsToBand(supabase, versionId, auth.band.id))) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Reuse the existing active link so a version has a single stable URL.
  const { data: existing } = await supabase
    .from("recording_shares")
    .select("token")
    .eq("version_id", versionId)
    .is("revoked_at", null)
    .single();

  if (existing) {
    return NextResponse.json({
      share: { token: existing.token, url: shareUrl(request, existing.token) },
    });
  }

  const token = generateShareToken();
  const { data: created, error } = await supabase
    .from("recording_shares")
    .insert({
      version_id: versionId,
      token,
      created_by_member_id: auth.member.id,
    })
    .select("token")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { share: { token: created.token, url: shareUrl(request, created.token) } },
    { status: 201 }
  );
}

// Revoke the active share link for this version.
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

  if (!(await versionBelongsToBand(supabase, versionId, auth.band.id))) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("recording_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("version_id", versionId)
    .is("revoked_at", null);

  if (error) {
    return NextResponse.json(
      { error: "Failed to revoke share link" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
