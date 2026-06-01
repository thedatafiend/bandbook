import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSharedRecording } from "@/lib/shares";

// Public, unauthenticated: resolve a share token to its recording so a 3rd
// party can stream it. Returns only what the listener is allowed to see.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  const recording = await getSharedRecording(supabase, token);
  if (!recording) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ recording });
}
