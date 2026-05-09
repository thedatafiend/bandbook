import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// Returns a short-lived signed URL the browser can PUT directly to. Uploads
// must bypass this Vercel function — the platform 413s any request body
// over ~4.5MB, and audio versions are routinely larger than that.
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

    const { data: song } = await supabase
      .from("songs")
      .select("id")
      .eq("id", songId)
      .eq("band_id", auth.band.id)
      .single();
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const filename = typeof body.filename === "string" ? body.filename : "";
    const ext = (filename.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";

    const path = `${auth.band.id}/${songId}/${randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("audio")
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("createSignedUploadUrl error:", error);
      return NextResponse.json(
        { error: `Failed to create upload URL: ${error?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    });
  } catch (err) {
    console.error("upload-url unhandled error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
